import type { AtomicsMode } from "../atomics"

export interface SerializedError {
  __error_marker: "$$error"
  message: string
  name: string
  stack?: string
}

/////////////////////////////
// Messages sent by master:

export enum MasterMessageType {
  atomicsInit = "atomicsInit",
  cancel = "cancel",
  run = "run"
}

export type MasterAtomicsInitMessage = {
  type: MasterMessageType.atomicsInit,
  sharedBuffer: Int32Array,
  atomicsMode: AtomicsMode
}

export type MasterJobCancelMessage = {
  type: MasterMessageType.cancel,
  uid: number
}

export type MasterJobRunMessage = {
  type: MasterMessageType.run,
  uid: number,
  method?: string,
  args: any[]
}

export type MasterSentMessage = MasterAtomicsInitMessage | MasterJobCancelMessage | MasterJobRunMessage

////////////////////////////
// Messages sent by worker:

export enum WorkerMessageType {
  error = "error",
  init = "init",
  result = "result",
  running = "running",
  uncaughtError = "uncaughtError"
}

export type WorkerUncaughtErrorMessage = {
  type: WorkerMessageType.uncaughtError,
  error: {
    message: string,
    name: string,
    stack?: string
  }
}

export type WorkerInitMessage = {
  type: WorkerMessageType.init,
  exposed: { type: "function" } | { type: "module", methods: string[] }
}

export type WorkerJobErrorMessage = {
  type: WorkerMessageType.error,
  uid: number,
  error: SerializedError
}

export type WorkerJobResultMessage = {
  type: WorkerMessageType.result,
  uid: number,
  complete?: true,
  payload?: any
}

export type WorkerJobStartMessage = {
  type: WorkerMessageType.running,
  uid: number,
  resultType: "observable" | "promise"
}

export type WorkerSentMessage =
  | WorkerInitMessage
  | WorkerJobErrorMessage
  | WorkerJobResultMessage
  | WorkerJobStartMessage
  | WorkerUncaughtErrorMessage
