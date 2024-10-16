import * as needle from "needle"

type RequestResponse<T> = needle.NeedleResponse & { body?: T }

export function request<T>(url: string, body: needle.BodyData, options?: needle.NeedleOptions) {
	return new Promise<RequestResponse<T>>((resolve, reject) =>
		needle.post(url, body, options, (error, response) => {
			if (error) {
				reject(error)
			} else {
				resolve(response)
			}
		}),
	)
}
