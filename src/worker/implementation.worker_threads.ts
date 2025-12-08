// tslint:disable no-shadowed-variable
import { MessagePort } from "worker_threads"
import {
  kRequestCountField,
  kResponseCountField,
  AtomicsMode
} from "../atomics"
import { AbstractedWorkerAPI } from "../types/worker"
import WorkerThreads from "../worker_threads"

function assertMessagePort(port: MessagePort | null | undefined): MessagePort {
  if (!port) {
    throw Error("Invariant violation: MessagePort to parent is not available.")
  }
  return port
}

// Atomics state
let sharedBuffer: Int32Array | null = null
let atomicsMode: AtomicsMode = "disabled"
let lastSeenRequestCount = 0
let messageHandlers: Set<(message: any) => void> = new Set()
let atomicsLoopRunning = false

const isWorkerRuntime: AbstractedWorkerAPI["isWorkerRuntime"] = function isWorkerRuntime() {
  return !WorkerThreads().isMainThread
}

const postMessageToMaster: AbstractedWorkerAPI["postMessageToMaster"] = function postMessageToMaster(data, transferList) {
  assertMessagePort(WorkerThreads().parentPort).postMessage(data, transferList as any)

  // Signal response availability via atomics
  if (sharedBuffer && atomicsMode !== "disabled") {
    Atomics.add(sharedBuffer, kResponseCountField, 1)
  }
}

/**
 * Process all pending messages synchronously using receiveMessageOnPort.
 * This avoids event-loop overhead when used with atomics.
 */
function processPendingMessages() {
  const wt = WorkerThreads()
  const parentPort = wt.parentPort
  if (!parentPort) return

  let received
  while ((received = wt.receiveMessageOnPort(parentPort)) !== undefined) {
    const message = received.message
    for (const handler of messageHandlers) {
      handler(message)
    }
  }
}

/**
 * Main atomics wait loop. Blocks until notified by master, then processes messages.
 * Runs in a separate "thread" via setImmediate to allow async operations.
 */
function runAtomicsLoop() {
  if (atomicsLoopRunning || !sharedBuffer || atomicsMode === "disabled") {
    return
  }
  atomicsLoopRunning = true

  const runIteration = () => {
    if (!sharedBuffer || atomicsMode === "disabled") {
      atomicsLoopRunning = false
      return
    }

    // Check for new requests
    const currentRequestCount = Atomics.load(sharedBuffer, kRequestCountField)
    if (currentRequestCount !== lastSeenRequestCount) {
      lastSeenRequestCount = currentRequestCount
      processPendingMessages()
    }

    if (atomicsMode === "sync") {
      // Synchronous wait - blocks the thread until notified
      // Use a timeout to allow periodic checking and async operations
      const result = Atomics.wait(sharedBuffer, kRequestCountField, lastSeenRequestCount, 100)
      if (result === "ok" || result === "not-equal") {
        lastSeenRequestCount = Atomics.load(sharedBuffer, kRequestCountField)
        processPendingMessages()
      }
      // Use setImmediate to allow other async operations to proceed
      setImmediate(runIteration)
    } else if (atomicsMode === "async") {
      // Async wait - uses Atomics.waitAsync if available
      const waitAsync = (Atomics as any).waitAsync
      if (typeof waitAsync === "function") {
        const result = waitAsync(sharedBuffer, kRequestCountField, lastSeenRequestCount)
        if (result.async) {
          result.value.then(() => {
            lastSeenRequestCount = Atomics.load(sharedBuffer!, kRequestCountField)
            processPendingMessages()
            setImmediate(runIteration)
          })
        } else {
          // Resolved synchronously
          if (result.value === "not-equal") {
            lastSeenRequestCount = Atomics.load(sharedBuffer, kRequestCountField)
            processPendingMessages()
          }
          setImmediate(runIteration)
        }
      } else {
        // Fallback to sync mode if waitAsync not available
        atomicsMode = "sync"
        setImmediate(runIteration)
      }
    }
  }

  // Start the loop
  setImmediate(runIteration)
}

const subscribeToMasterMessages: AbstractedWorkerAPI["subscribeToMasterMessages"] = function subscribeToMasterMessages(onMessage) {
  const parentPort = WorkerThreads().parentPort

  if (!parentPort) {
    throw Error("Invariant violation: MessagePort to parent is not available.")
  }

  if (atomicsMode !== "disabled" && sharedBuffer) {
    // Atomics mode: add handler to set and ensure loop is running
    messageHandlers.add(onMessage)
    runAtomicsLoop()

    return () => {
      messageHandlers.delete(onMessage)
    }
  } else {
    // Traditional event-based mode
    const messageHandler = (message: any) => {
      onMessage(message)
    }
    const unsubscribe = () => {
      assertMessagePort(parentPort).off("message", messageHandler)
    }
    assertMessagePort(parentPort).on("message", messageHandler)
    return unsubscribe
  }
}

/**
 * Initialize atomics support for this worker.
 * Called when receiving the atomics init message from master.
 */
export function initializeAtomics(buffer: Int32Array, mode: AtomicsMode) {
  sharedBuffer = buffer
  atomicsMode = mode
  lastSeenRequestCount = Atomics.load(buffer, kRequestCountField)

  // If there are already registered handlers, start the loop
  if (messageHandlers.size > 0) {
    runAtomicsLoop()
  }
}

/**
 * Check if atomics is currently enabled.
 */
export function isAtomicsEnabled(): boolean {
  return atomicsMode !== "disabled" && sharedBuffer !== null
}

function testImplementation() {
  // Will throw if `worker_threads` are not available
  WorkerThreads()
}

export default {
  isWorkerRuntime,
  postMessageToMaster,
  subscribeToMasterMessages,
  testImplementation
}
