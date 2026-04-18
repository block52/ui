import axios from "axios";
import HTTPClient from "../apis/HTTPClient";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("httpClient", () => {
    let httpClient: any;
    let mockAxiosInstance: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockAxiosInstance = {
            get: jest.fn(),
            post: jest.fn(),
            put: jest.fn(),
            delete: jest.fn(),
            interceptors: {
                request: { use: jest.fn() },
                response: { use: jest.fn() }
            }
        };
        mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
        httpClient = new HTTPClient({ baseUrl: "https://api.example.com", secure: false });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("GET requests", () => {
        it("should make a successful GET request", async () => {
            const mockData = { id: 1, name: "Test" };
            mockAxiosInstance.get.mockResolvedValueOnce({ data: mockData });

            const result = await httpClient.get("/api/test");

            expect(result).toEqual(mockData);
            expect(mockAxiosInstance.get).toHaveBeenCalledWith("/api/test", undefined);
        });

        it("should handle GET request errors", async () => {
            mockAxiosInstance.get.mockRejectedValueOnce({
                response: { data: "Not Found", status: 404 }
            });

            await expect(httpClient.get("/api/missing")).rejects.toBe("Not Found");
        });

        it("should pass config to GET request", async () => {
            const mockData = { results: [] };
            mockAxiosInstance.get.mockResolvedValueOnce({ data: mockData });

            const config = { params: { q: "test", limit: "10" } };
            await httpClient.get("/api/search", config);

            expect(mockAxiosInstance.get).toHaveBeenCalledWith("/api/search", config);
        });
    });

    describe("POST requests", () => {
        it("should make a successful POST request", async () => {
            const mockData = { id: 1, created: true };
            const payload = { name: "New Item" };
            mockAxiosInstance.post.mockResolvedValueOnce({ data: mockData });

            const result = await httpClient.post("/api/items", payload);

            expect(result).toEqual(mockData);
            expect(mockAxiosInstance.post).toHaveBeenCalledWith("/api/items", payload, undefined);
        });

        it("should handle POST request errors", async () => {
            mockAxiosInstance.post.mockRejectedValueOnce({
                response: { data: "Bad Request", status: 400 }
            });

            await expect(httpClient.post("/api/items", { invalid: "data" })).rejects.toBe("Bad Request");
        });

        it("should pass config to POST request", async () => {
            mockAxiosInstance.post.mockResolvedValueOnce({ data: {} });

            const config = { headers: { "X-Custom": "header" } };
            await httpClient.post("/api/items", { test: "data" }, config);

            expect(mockAxiosInstance.post).toHaveBeenCalledWith("/api/items", { test: "data" }, config);
        });
    });

    describe("PUT requests", () => {
        it("should make a successful PUT request", async () => {
            const mockData = { id: 1, updated: true };
            const payload = { name: "Updated Item" };
            mockAxiosInstance.put.mockResolvedValueOnce({ data: mockData });

            const result = await httpClient.put("/api/items/1", payload);

            expect(result).toEqual(mockData);
            expect(mockAxiosInstance.put).toHaveBeenCalledWith("/api/items/1", payload, undefined);
        });

        it("should handle PUT request errors", async () => {
            mockAxiosInstance.put.mockRejectedValueOnce({
                response: { data: "Not Found", status: 404 }
            });

            await expect(httpClient.put("/api/items/999", {})).rejects.toBe("Not Found");
        });
    });

    describe("DELETE requests", () => {
        it("should make a successful DELETE request", async () => {
            mockAxiosInstance.delete.mockResolvedValueOnce({ data: { deleted: true } });

            const result = await httpClient.delete("/api/items/1");

            expect(result).toEqual({ deleted: true });
            expect(mockAxiosInstance.delete).toHaveBeenCalledWith("/api/items/1", undefined);
        });

        it("should handle DELETE request errors", async () => {
            mockAxiosInstance.delete.mockRejectedValueOnce({
                response: { data: "Not Found", status: 404 }
            });

            await expect(httpClient.delete("/api/items/999")).rejects.toBe("Not Found");
        });
    });

    describe("Error handling", () => {
        it("should throw error on network failure", async () => {
            const networkError = new Error("Network error");
            mockAxiosInstance.get.mockRejectedValueOnce(networkError);

            await expect(httpClient.get("/api/test")).rejects.toThrow("Network error");
        });

        it("should throw response data when available", async () => {
            mockAxiosInstance.get.mockRejectedValueOnce({
                response: { data: { message: "Server Error" }, status: 500 }
            });

            await expect(httpClient.get("/api/test")).rejects.toEqual({ message: "Server Error" });
        });

        it("should call custom error handler", async () => {
            const customHandler = jest.fn();
            httpClient.setCustomOnError(customHandler);

            mockAxiosInstance.get.mockRejectedValueOnce({
                response: { data: "Something went wrong", status: 500 }
            });

            await expect(httpClient.get("/api/test")).rejects.toBe("Something went wrong");
            expect(customHandler).toHaveBeenCalledWith("Something went wrong");
        });
    });

    describe("Constructor", () => {
        it("should create axios instance with correct config", () => {
            expect(mockedAxios.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    baseURL: "https://api.example.com"
                })
            );
        });

        it("should add auth interceptor when secure is true", () => {
            const secureInstance = {
                ...mockAxiosInstance,
                interceptors: {
                    request: { use: jest.fn() },
                    response: { use: jest.fn() }
                }
            };
            mockedAxios.create.mockReturnValue(secureInstance as any);

            new HTTPClient({ baseUrl: "https://api.example.com", secure: true });

            expect(secureInstance.interceptors.request.use).toHaveBeenCalled();
        });

        it("should not add auth interceptor when secure is false", () => {
            expect(mockAxiosInstance.interceptors.request.use).not.toHaveBeenCalled();
        });
    });

    describe("URL construction", () => {
        it("should pass URL paths to axios instance", async () => {
            mockAxiosInstance.get.mockResolvedValueOnce({ data: {} });

            await httpClient.get("/api/games/123");

            expect(mockAxiosInstance.get).toHaveBeenCalledWith("/api/games/123", undefined);
        });
    });

    describe("Timeout", () => {
        it("should pass timeout to axios instance config", () => {
            mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

            new HTTPClient({ baseUrl: "https://api.example.com", secure: false, timeout: 5000 });

            expect(mockedAxios.create).toHaveBeenCalledWith(expect.objectContaining({ timeout: 5000 }));
        });

        it("should not set timeout when not provided", () => {
            mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

            new HTTPClient({ baseUrl: "https://api.example.com", secure: false });

            expect(mockedAxios.create).toHaveBeenCalledWith(expect.objectContaining({ timeout: undefined }));
        });

        it("should reject with error on request timeout", async () => {
            const timeoutError = new Error("timeout of 5000ms exceeded");
            Object.assign(timeoutError, { code: "ECONNABORTED" });
            mockAxiosInstance.get.mockRejectedValueOnce(timeoutError);

            await expect(httpClient.get("/api/slow")).rejects.toThrow("timeout of 5000ms exceeded");
        });

        it("should call custom error handler on timeout", async () => {
            const customHandler = jest.fn();
            httpClient.setCustomOnError(customHandler);

            const timeoutError = new Error("timeout of 5000ms exceeded");
            Object.assign(timeoutError, { code: "ECONNABORTED" });
            mockAxiosInstance.get.mockRejectedValueOnce(timeoutError);

            await expect(httpClient.get("/api/slow")).rejects.toThrow("timeout of 5000ms exceeded");
            expect(customHandler).toHaveBeenCalled();
        });
    });
});
