// tslint:disable no-var-requires
/*
 * This file is only a stub to make './implementation' resolve to the right module.
 */

import { AtomicsMode } from "../atomics"
import { AbstractedWorkerAPI } from "../types/worker"
import WebWorkerImplementation, {
  initializeAtomics as browserInitializeAtomics
} from "./implementation.browser"
import TinyWorkerImplementation, {
  initializeAtomics as tinyWorkerInitializeAtomics
} from "./implementation.tiny-worker"
import WorkerThreadsImplementation, {
  initializeAtomics as workerThreadsInitializeAtomics
} from "./implementation.worker_threads"

const runningInNode = typeof process !== 'undefined' && process.arch !== 'browser' && 'pid' in process

type InitializeAtomicsFn = (buffer: Int32Array, mode: AtomicsMode) => void

let selectedInitializeAtomics: InitializeAtomicsFn = browserInitializeAtomics

function selectNodeImplementation(): AbstractedWorkerAPI {
  try {
    WorkerThreadsImplementation.testImplementation()
    selectedInitializeAtomics = workerThreadsInitializeAtomics
    return WorkerThreadsImplementation
  } catch (error) {
    selectedInitializeAtomics = tinyWorkerInitializeAtomics
    return TinyWorkerImplementation
  }
}

export default runningInNode
  ? selectNodeImplementation()
  : WebWorkerImplementation

/**
 * Initialize atomics support. Only works with worker_threads implementation.
 */
export function initializeAtomics(buffer: Int32Array, mode: AtomicsMode): void {
  selectedInitializeAtomics(buffer, mode)
}
