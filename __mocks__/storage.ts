// __mocks__/storage.ts
export const saveToStorage = jest.fn(
    (_key: string, _value: any, _storageType?: string, _metadata?: Record<string, any>) =>
      Promise.resolve('')
  ) as jest.Mock<Promise<string>, [string, any, string?, Record<string, any>?]>;
  export const removeFromStorage = jest.fn(
    (_key: string, _storageType?: string) => Promise.resolve()
  ) as jest.Mock<Promise<void>, [string, string?]>;