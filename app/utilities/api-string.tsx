import { environment } from "./../environments/environment.development"

export const apiString = (data: string | string[]): string => {
    let base = environment.api
    if (typeof data === "string") {
        base += ("/" + data)
    } else {
        let path = ""
        data.forEach(res => {
            path += ("/" + res)
        })
        base += path
    }
    return base
}
