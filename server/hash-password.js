#!/usr/bin/env node
/**
 * CLI: generate a bcrypt hash for ADMIN_PASSWORD_HASH.
 *
 * Usage:
 *   npm run hash-password -- <password>
 *   node server/hash-password.js <password>
 *
 * If no argument is provided, prompts via stdin.
 */
const bcrypt = require('bcryptjs');
const readline = require('readline');

const ROUNDS = 10;

async function fromArg(pw) {
  const hash = await bcrypt.hash(pw, ROUNDS);
  process.stdout.write(hash + '\n');
}

function prompt() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
    terminal: true,
  });
  rl.question('Password to hash: ', async (pw) => {
    rl.close();
    if (!pw) {
      console.error('No password entered.');
      process.exit(1);
    }
    await fromArg(pw);
  });
}

const arg = process.argv[2];
if (arg) {
  fromArg(arg).catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  prompt();
}
