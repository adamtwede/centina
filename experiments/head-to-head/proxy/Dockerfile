# The only way out of the internal network: a forward proxy that allows the
# hosts in `allowlist` and denies everything else, logging both. Run
# containers reach it as http://centina-h2h-proxy:8888.
FROM alpine:3.20

RUN apk add --no-cache tinyproxy

COPY tinyproxy.conf /etc/tinyproxy/tinyproxy.conf
COPY allowlist /etc/tinyproxy/allowlist

EXPOSE 8888
CMD ["tinyproxy", "-d", "-c", "/etc/tinyproxy/tinyproxy.conf"]
