Implement the loop described in /work.

Everything in /work except `contract.ts` is your source: it describes the
loop to build. `contract.ts` is the I/O contract the implementation must
meet. Write the implementation as `/work/loop.ts`, exporting `run` with the
contract's signature. Read the whole source and the contract before you start.

Where the source is unclear, contradicts itself, or looks wrong, write it
down in `/work/NOTES.md` before you decide how to handle it. For each one, say
where it is, what the problem is, which choice you made, and why. Then make
that choice and carry on. There is no one to ask, so don't stop to wait for
an answer.

Don't change any file you were given. You may write and run your own checks
(TypeScript, `tsc` and `tsx` are installed), but `loop.ts` must stand alone,
importing nothing but the contract's types. When `loop.ts` is done, end with
a short summary of what you built.
