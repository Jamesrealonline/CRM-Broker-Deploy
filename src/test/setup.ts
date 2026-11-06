class LocalStorageMock {
  private store: Record<string, string> = {};

  clear() {
    this.store = {};
  }

  getItem(key: string) {
    return this.store[key] || null;
  }

  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }

  removeItem(key: string) {
    delete this.store[key];
  }
}

globalThis.localStorage = new LocalStorageMock() as any;

if (typeof (globalThis as any).WebSocket === 'undefined') {
  (globalThis as any).WebSocket = class WebSocketMock {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
    readonly readyState = 1;
    send() {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
  };
}
