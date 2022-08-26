/**
 * CORS Anywhere as a Cloudflare Worker!
 * (c) 2019 by Zibri (www.zibri.org)
 * email: zibri AT zibri DOT org
 * https://github.com/Zibri/cloudflare-cors-anywhere
 */

/**
 * whitelist = [ "^http.?://www.zibri.org$", "zibri.org$", "test\\..*" ];  // regexp for whitelisted urls
 */

const blacklist = [] // regexp for blacklisted urls
const whitelist = [".*"] // regexp for whitelisted origins

function isListed(uri, listing) {
    let ret = false
    if (typeof uri == "string") {
        listing.forEach((m) => {
            if (uri.match(m) != null) ret = true
        })
    } else {
        // decide what to do when Origin is null
        // true accepts null origins false rejects them.
        ret = true
    }
    return ret
}

function fix(event, myHeaders, isOPTIONS) {
    // myHeaders.set("Access-Control-Allow-Origin", event.request.headers.get("Origin"));
    myHeaders.set("Access-Control-Allow-Origin", "*")

    if (isOPTIONS) {
        // myHeaders.set("Access-Control-Allow-Methods", event.request.headers.get("access-control-request-method"));
        acrh = event.request.headers.get("access-control-request-headers")
        myHeaders.set("Access-Control-Allow-Credentials", "true")

        if (acrh) {
            myHeaders.set("Access-Control-Allow-Headers", acrh)
        }

        myHeaders.delete("X-Content-Type-Options")
    }
    return myHeaders
}

addEventListener("fetch", async (event) => {
    event.respondWith(
        (async function () {
            const isOPTIONS = event.request.method == "OPTIONS"
            const origin_url = new URL(event.request.url)
            const fetch_url = decodeURIComponent(
                decodeURIComponent(origin_url.search.substr(1))
            )
            const orig = event.request.headers.get("Origin")
            const remIp = event.request.headers.get("CF-Connecting-IP")

            if (!isListed(fetch_url, blacklist) && isListed(orig, whitelist)) {
                let xheaders = event.request.headers.get("x-cors-headers")

                if (xheaders != null) {
                    try {
                        xheaders = JSON.parse(xheaders)
                    } catch (e) {
                        console.log("e", e)
                    }
                }

                if (origin_url.search.startsWith("?")) {
                    recv_headers = {}
                    for (let pair of event.request.headers.entries()) {
                        if (
                            pair[0].match("^origin") == null &&
                            pair[0].match("eferer") == null &&
                            pair[0].match("^cf-") == null &&
                            pair[0].match("^x-forw") == null &&
                            pair[0].match("^x-cors-headers") == null
                        ) {
                            recv_headers[pair[0]] = pair[1]
                        }
                    }

                    if (xheaders != null) {
                        Object.entries(xheaders).forEach(
                            (c) => (recv_headers[c[0]] = c[1])
                        )
                    }

                    let newreq = new Request(event.request, {
                        redirect: "follow",
                        headers: recv_headers,
                    })

                    const response = await fetch(fetch_url, newreq)
                    let myHeaders = new Headers(response.headers)
                    let cors_headers = []
                    let allh = {}
                    for (let pair of response.headers.entries()) {
                        cors_headers.push(pair[0])
                        allh[pair[0]] = pair[1]
                    }
                    cors_headers.push("cors-received-headers")

                    myHeaders = fix(event, myHeaders, isOPTIONS)
                    myHeaders.set(
                        "Access-Control-Expose-Headers",
                        cors_headers.join(",")
                    )
                    myHeaders.set("cors-received-headers", JSON.stringify(allh))

                    let body = null

                    if (!isOPTIONS) {
                        body = await response.arrayBuffer()
                    }

                    const init = {
                        headers: myHeaders,
                        status: isOPTIONS ? 200 : response.status,
                        statusText: isOPTIONS ? "OK" : response.statusText,
                    }
                    return new Response(body, init)
                } else {
                    let myHeaders = new Headers()
                    myHeaders = fix(event, myHeaders, isOPTIONS)

                    if (typeof event.request.cf != "undefined") {
                        if (typeof event.request.cf.country != "undefined") {
                            country = event.request.cf.country
                        } else {
                            country = false
                        }

                        if (typeof event.request.cf.colo != "undefined") {
                            colo = event.request.cf.colo
                        } else {
                            colo = false
                        }
                    } else {
                        country = false
                        colo = false
                    }

                    return new Response(
                        "Usage:\n" +
                            origin_url.origin +
                            "/?uri\n\n" +
                            (orig != null ? "Origin: " + orig + "\n" : "") +
                            "Ip: " +
                            remIp +
                            "\n" +
                            (country ? "Country: " + country + "\n" : "") +
                            (colo ? "Datacenter: " + colo + "\n" : "") +
                            "\n" +
                            (xheaders != null
                                ? "\nx-cors-headers: " +
                                JSON.stringify(xheaders)
                                : ""),
                        {status: 200, headers: myHeaders}
                    )
                }
            } else {
                return new Response({
                    status: 403,
                    statusText: "Forbidden",
                    headers: {
                        "Content-Type": "text/html",
                    },
                })
            }
        })()
    )
})
 