import net from 'net'

function proxyAuthorization(username, password) {
  if (!username && !password) return ''
  return `Basic ${Buffer.from(`${username}:${password}`, 'utf8').toString('base64')}`
}

function parseHeaderBlock(buffer) {
  const raw = buffer.toString('latin1')
  const end = raw.indexOf('\r\n\r\n')
  if (end === -1) return null

  const lines = raw.slice(0, end).split('\r\n')
  const requestLine = lines.shift()
  if (!requestLine) return null

  return {
    requestLine,
    headers: lines,
    body: buffer.subarray(end + 4)
  }
}

function stripProxyAuthorization(headers) {
  return headers.filter(header => !/^proxy-authorization\s*:/i.test(header))
}

export class HttpProxyRelay {
  constructor({ host, port, username, password }) {
    this.host = host
    this.port = Number(port)
    this.username = username
    this.password = password
    this.server = null
    this.localPort = null
    this.closed = false
  }

  async start() {
    if (this.server) return this.localPort

    this.server = net.createServer(socket => this._handleClient(socket))
    this.server.on('error', () => {})

    await new Promise((resolve, reject) => {
      const onError = error => {
        this.server?.off('listening', onListening)
        reject(error)
      }
      const onListening = () => {
        this.server?.off('error', onError)
        resolve()
      }
      this.server.once('error', onError)
      this.server.once('listening', onListening)
      this.server.listen(0, '127.0.0.1')
    })

    const address = this.server.address()
    this.localPort = typeof address === 'object' && address ? address.port : null
    if (!this.localPort) throw new Error('Could not allocate a local proxy port')
    return this.localPort
  }

  close() {
    if (this.closed) return
    this.closed = true
    try { this.server?.close() } catch (_) {}
    this.server = null
    this.localPort = null
  }

  _handleClient(client) {
    let received = Buffer.alloc(0)
    const maxHeaderSize = 64 * 1024

    const fail = () => {
      try { client.destroy() } catch (_) {}
    }

    const receiveHeader = chunk => {
      received = Buffer.concat([received, chunk])
      if (received.length > maxHeaderSize) return fail()

      const request = parseHeaderBlock(received)
      if (!request) return
      client.off('data', receiveHeader)
      this._forwardRequest(client, request)
    }

    client.on('error', () => {})
    client.on('data', receiveHeader)
  }

  _forwardRequest(client, request) {
    const [method = '', destination = ''] = request.requestLine.split(' ')
    const upstream = net.createConnection({ host: this.host, port: this.port })
    const auth = proxyAuthorization(this.username, this.password)
    const authHeader = auth ? `Proxy-Authorization: ${auth}` : ''

    const closeBoth = () => {
      try { upstream.destroy() } catch (_) {}
      try { client.destroy() } catch (_) {}
    }

    upstream.on('error', closeBoth)
    client.on('error', () => { try { upstream.destroy() } catch (_) {} })

    upstream.once('connect', () => {
      if (method.toUpperCase() === 'CONNECT') {
        const hostHeader = destination || ''
        upstream.write([
          `CONNECT ${destination} HTTP/1.1`,
          `Host: ${hostHeader}`,
          ...(authHeader ? [authHeader] : []),
          'Proxy-Connection: Keep-Alive',
          '',
          ''
        ].join('\r\n'))

        this._tunnelConnect(client, upstream)
        return
      }

      const forwardedHeaders = stripProxyAuthorization(request.headers)
      upstream.write([
        request.requestLine,
        ...forwardedHeaders,
        ...(authHeader ? [authHeader] : []),
        '',
        ''
      ].join('\r\n'))
      if (request.body.length) upstream.write(request.body)
      client.pipe(upstream)
      upstream.pipe(client)
    })
  }

  _tunnelConnect(client, upstream) {
    let response = Buffer.alloc(0)
    const maxHeaderSize = 64 * 1024

    const receiveResponse = chunk => {
      response = Buffer.concat([response, chunk])
      if (response.length > maxHeaderSize) {
        try { upstream.destroy() } catch (_) {}
        try { client.destroy() } catch (_) {}
        return
      }

      const end = response.indexOf('\r\n\r\n')
      if (end === -1) return
      upstream.off('data', receiveResponse)

      const header = response.subarray(0, end + 4)
      const rest = response.subarray(end + 4)
      client.write(header)

      if (!/^HTTP\/1\.[01]\s+2\d\d\b/i.test(header.toString('latin1'))) {
        try { client.end() } catch (_) {}
        try { upstream.end() } catch (_) {}
        return
      }

      if (rest.length) client.write(rest)
      client.pipe(upstream)
      upstream.pipe(client)
    }

    upstream.on('data', receiveResponse)
  }
}
