import test from "ava"
import { spawn, Thread, Worker } from "../src/index"

test("can spawn a thread with atomics: sync", async t => {
  const increment = await spawn<(by?: number) => number>(
    new Worker("./workers/increment.ts"),
    { atomics: "sync" }
  )

  const result = await increment(5)
  t.is(result, 5)

  // Verify sharedBuffer is set
  const sharedBuffer = Thread.sharedBuffer(increment)
  t.truthy(sharedBuffer, "sharedBuffer should be set when using atomics")
  t.true(sharedBuffer instanceof Int32Array, "sharedBuffer should be Int32Array")

  await Thread.terminate(increment)
})

test("can spawn a thread with atomics: async", async t => {
  const increment = await spawn<(by?: number) => number>(
    new Worker("./workers/increment.ts"),
    { atomics: "async" }
  )

  const result = await increment(5)
  t.is(result, 5)

  // Verify sharedBuffer is set
  const sharedBuffer = Thread.sharedBuffer(increment)
  t.truthy(sharedBuffer, "sharedBuffer should be set when using atomics")

  await Thread.terminate(increment)
})

test("can spawn a thread with atomics: disabled (default)", async t => {
  const increment = await spawn<(by?: number) => number>(
    new Worker("./workers/increment.ts")
  )

  const result = await increment(5)
  t.is(result, 5)

  // Verify sharedBuffer is NOT set
  const sharedBuffer = Thread.sharedBuffer(increment)
  t.is(sharedBuffer, null, "sharedBuffer should be null when not using atomics")

  await Thread.terminate(increment)
})

test("can call a thread with atomics multiple times", async t => {
  const increment = await spawn<(by?: number) => number>(
    new Worker("./workers/increment.ts"),
    { atomics: "sync" }
  )

  // Make multiple calls sequentially to test atomics signaling
  const result1 = await increment(1)
  const result2 = await increment(2)
  const result3 = await increment(3)
  const result4 = await increment(4)
  const result5 = await increment(5)

  t.is(result1, 1)
  t.is(result2, 3)
  t.is(result3, 6)
  t.is(result4, 10)
  t.is(result5, 15)

  await Thread.terminate(increment)
})
