/**
 * SharedArrayBuffer field indices for worker synchronization.
 *
 * This module implements a low-overhead synchronization mechanism using
 * SharedArrayBuffer and Atomics to reduce event-loop overhead when
 * dispatching tasks to workers.
 *
 * The pattern:
 * 1. Master increments requestCount and calls Atomics.notify()
 * 2. Worker blocks on Atomics.wait() until notified
 * 3. Worker processes messages, then increments responseCount
 * 4. Master can poll responseCount with Atomics.load() for fast response detection
 */

/** Index for request counter - master writes, worker reads */
export const kRequestCountField = 0

/** Index for response counter - worker writes, master reads */
export const kResponseCountField = 1

/** Total number of Int32 fields in the shared buffer */
export const kFieldCount = 2

/** Size in bytes for the SharedArrayBuffer */
export const kSharedBufferSize = kFieldCount * Int32Array.BYTES_PER_ELEMENT

/**
 * Creates a new SharedArrayBuffer for worker synchronization.
 * Returns null if SharedArrayBuffer is not available.
 */
export function createSharedBuffer(): Int32Array | null {
  if (typeof SharedArrayBuffer === "undefined") {
    return null
  }
  return new Int32Array(new SharedArrayBuffer(kSharedBufferSize))
}

/**
 * Signal to a worker that new work is available.
 * Call this after posting a message to wake the worker from Atomics.wait().
 */
export function notifyWorker(sharedBuffer: Int32Array): void {
  Atomics.add(sharedBuffer, kRequestCountField, 1)
  Atomics.notify(sharedBuffer, kRequestCountField, 1)
}

/**
 * Signal that a response has been sent.
 * Called by worker after posting result message.
 */
export function signalResponse(sharedBuffer: Int32Array): void {
  Atomics.add(sharedBuffer, kResponseCountField, 1)
}

/**
 * Check if there are pending responses without blocking.
 * Returns the current response count for comparison.
 */
export function getResponseCount(sharedBuffer: Int32Array): number {
  return Atomics.load(sharedBuffer, kResponseCountField)
}

/**
 * Get the current request count.
 */
export function getRequestCount(sharedBuffer: Int32Array): number {
  return Atomics.load(sharedBuffer, kRequestCountField)
}

export type AtomicsMode = "sync" | "async" | "disabled"
