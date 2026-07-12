#!/bin/sh
# Detects the primary non-loopback IPv4 address on macOS/Linux.
# Tries common interfaces first, falls back to parsing ifconfig/ip.

for IFACE in en0 en1 eth0 wlan0; do
  IP=$(ipconfig getifaddr "$IFACE" 2>/dev/null) && [ -n "$IP" ] && echo "$IP" && exit 0
done

# Fallback: parse ifconfig
IP=$(ifconfig 2>/dev/null | grep -E "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
[ -n "$IP" ] && echo "$IP" && exit 0

# Fallback: parse ip addr
IP=$(ip addr 2>/dev/null | grep -E "inet " | grep -v 127.0.0.1 | awk '{print $2}' | cut -d/ -f1 | head -1)
[ -n "$IP" ] && echo "$IP" && exit 0

echo "127.0.0.1"
