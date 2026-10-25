#!/usr/bin/env node
// Builds the images and manages the network the head-to-head runs sit on
// (docs/head-to-head.md, "Isolation", control 2). Run containers join an
// internal network with no route out; the proxy joins that network and an
// ordinary one, and passes only the hosts in proxy/allowlist.
//
// Usage: node experiments/head-to-head/net.mjs <command>
//   build    build the run and proxy images
//   up       create both networks and start the proxy
//   down     stop the proxy and remove both networks
//   hosts    every host the proxy saw, allowed and denied, with counts
//   status   whether the proxy is running

import path from "node:path"
import {
  docker,
  HERE,
  NET_EGRESS,
  NET_INTERNAL,
  PROXY_IMAGE,
  PROXY_NAME,
  proxyRunning,
  RUN_IMAGE,
} from "./lib.mjs"

function must(args) {
  const result = docker(args, { stdio: ["ignore", "pipe", "pipe"] })
  if (result.status !== 0) throw new Error(`docker ${args.join(" ")}\n${result.stderr.trim()}`)
  return result.stdout
}

function networkExists(name) {
  return docker(["network", "inspect", name]).status === 0
}

const commands = {
  build() {
    for (const [tag, dir] of [[PROXY_IMAGE, "proxy"], [RUN_IMAGE, "image"]]) {
      console.log(`building ${tag}`)
      const result = docker(["build", "-t", tag, path.join(HERE, dir)], { stdio: "inherit" })
      if (result.status !== 0) throw new Error(`building ${tag} failed`)
    }
  },

  up() {
    if (!networkExists(NET_INTERNAL)) must(["network", "create", "--internal", NET_INTERNAL])
    if (!networkExists(NET_EGRESS)) must(["network", "create", NET_EGRESS])
    if (!proxyRunning()) {
      docker(["rm", "-f", PROXY_NAME])
      must(["run", "-d", "--name", PROXY_NAME, "--network", NET_EGRESS, PROXY_IMAGE])
      must(["network", "connect", NET_INTERNAL, PROXY_NAME])
    }
    console.log(`proxy ${PROXY_NAME} up on ${NET_INTERNAL}`)
  },

  down() {
    docker(["rm", "-f", PROXY_NAME])
    for (const net of [NET_INTERNAL, NET_EGRESS]) if (networkExists(net)) must(["network", "rm", net])
    console.log("proxy and networks removed")
  },

  hosts() {
    const { stdout, stderr } = docker(["logs", PROXY_NAME])
    const counts = new Map()
    for (const line of (stdout + stderr).split("\n")) {
      // tinyproxy logs a tunnel as `Request (file descriptor N): CONNECT host:443 ...`
      // and a filtered one as `Proxying refused on filtered domain "host"`.
      const allowed = line.match(/CONNECT\s+([^\s:]+):\d+/)
      const denied = line.match(/filtered (?:domain|url) "([^"]+)"/i)
      const key = denied ? `denied  ${denied[1]}` : allowed ? `request ${allowed[1]}` : null
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    if (counts.size === 0) console.log("no requests logged")
    for (const [key, n] of [...counts].sort()) console.log(`${key}  x${n}`)
  },

  status() {
    console.log(proxyRunning() ? `${PROXY_NAME} running` : `${PROXY_NAME} not running`)
  },
}

const command = commands[process.argv[2]]
if (!command) {
  console.error("usage: net.mjs build | up | down | hosts | status")
  process.exit(2)
}
try {
  command()
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
