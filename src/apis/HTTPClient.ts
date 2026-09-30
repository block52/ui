import axios, { isAxiosError, AxiosError, AxiosRequestConfig, AxiosResponse, AxiosInstance } from "axios";
import { STORAGE_KEYS } from "../constants/storageKeys";

export interface HTTPClientConfig {
    baseUrl: string;
    secure: boolean;
    signal?: AbortSignal;
    timeout?: number;
    retries?: number;
}

/**
 * The message from a value an HTTPClient call rejected with: `onError` throws the
 * server's response body (e.g. `{ error: "Amount too small" }`) when there is one,
 * and the AxiosError itself when there isn't.
 */
export const httpErrorMessage = (err: unknown, fallback: string): string => {
    if (err instanceof Error) return err.message;
    if (typeof err === "object" && err !== null) {
        if ("error" in err && typeof err.error === "string") return err.error;
        if ("message" in err && typeof err.message === "string") return err.message;
    }
    return fallback;
};

/** True when an axios request (ours or the SDK's REST client) never reached the server. */
export const isNetworkError = (err: unknown): boolean => isAxiosError(err) && err.code === "ERR_NETWORK";

/** "<status> - <statusText>" for an axios error that got a response, otherwise undefined. */
export const httpStatusText = (err: unknown): string | undefined =>
    isAxiosError(err) && err.response ? `${err.response.status} - ${err.response.statusText}` : undefined;

export default class HTTPClient {
    private client: AxiosInstance;
    private customOnError!: (e: string) => void | undefined;

    constructor(config: HTTPClientConfig) {
        this.client = axios.create({
            baseURL: config.baseUrl,
            timeout: config.timeout,
            signal: config.signal
            // need to add headers here if we want to support secure endpoints in the future, but for now all endpoints are public so we can skip it
        });

        if (config.secure) {
            this.client.interceptors.request.use(
                async config => {
                    const token = await window.localStorage.getItem(STORAGE_KEYS.authToken);
                    if (token && config.headers) config.headers.Authorization = `Bearer ${token}`;
                    return config;
                },
                error => {
                    return Promise.reject(error);
                }
            );
        }
    }

    protected get = <T>(url: string, axiosReqConfig?: AxiosRequestConfig): Promise<T> =>
        this.client.get(url, axiosReqConfig).then(this.onSuccess).catch(this.onError) as unknown as Promise<T>;
    protected post = <T>(url: string, data?: unknown, reqConfig?: AxiosRequestConfig): Promise<T> =>
        this.client.post(url, data, reqConfig).then(this.onSuccess).catch(this.onError) as unknown as Promise<T>;
    protected put = <T>(url: string, data?: unknown, axiosReqConfig?: AxiosRequestConfig): Promise<T> =>
        this.client.put(url, data, axiosReqConfig).then(this.onSuccess).catch(this.onError) as unknown as Promise<T>;
    protected delete = <T>(url: string, axiosReqConfig?: AxiosRequestConfig): Promise<T> =>
        this.client.delete(url, axiosReqConfig).then(this.onSuccess).catch(this.onError) as unknown as Promise<T>;
    public setCustomOnError = (onError: (e: string) => void) => {
        this.customOnError = onError;
    };

    private onSuccess = (res: AxiosResponse) => res.data;
    private onError = (e: AxiosError) => {
        const error = e.response ? e.response.data : e;

        if (this.customOnError) {
            this.customOnError(error as string);
        }

        throw error;
    };
}
