import net from "node:net";

// Addresses a user's link must never make us call: loopback, private
// networks, link-local (cloud metadata), and the rest that isn't the internet.
const blocked = new net.BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 3],
] as const) {
  blocked.addSubnet(address, prefix, "ipv4");
}
for (const [address, prefix] of [
  ["::", 127], // :: and ::1
  ["64:ff9b::", 96], // NAT64
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(address, prefix, "ipv6");
}

/** True for an address a user's link must never make us call, or a non-address. */
export const isBlocked = (raw: string) => {
  // An IPv4-mapped address (::ffff:127.0.0.1) is checked as the IPv4 one. A
  // `::ffff:0:0/96` rule can't do it: BlockList matches it for every IPv4.
  const address = raw.replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/i, "");
  const family = net.isIP(address);
  return family === 0 || blocked.check(address, family === 6 ? "ipv6" : "ipv4");
};
