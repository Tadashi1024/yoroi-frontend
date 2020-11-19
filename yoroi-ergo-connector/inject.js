// replace "*" with location.origin before committing on all postMessage calls

//const yoroiExtensionId = "eegbdfmlofnpgiiilnlboaamccblbobe";
const yoroiExtensionId = "bgihpbbhciffmelcfbccneidnnmkcdhl";

// sets up RPC communication with the connector + access check/request functions
const initialInject = `
var timeout = 0;

var connectRequests = [];

window.addEventListener("message", function(event) {
    if (event.data.type == "connector_connected") {
        if (event.data.err !== undefined) {
            connectRequests.forEach(promise => promise.reject(event.data.err));
        } else {
            connectRequests.forEach(promise => promise.resolve(event.data.success));
        }
    }
});

function ergo_request_read_access() {
    return new Promise(function(resolve, reject) {
        window.postMessage({
            type: "connector_connect_request",
        }, "*");
        connectRequests.push({ resolve: resolve, reject: reject });
    });
}

// TODO: fix or change back how RPCs work
// // disconnect detector
// setInterval(function() {
//     if (timeout == 20) {
//         window.dispatchEvent(new Event("ergo_wallet_disconnected"));
//     }
//     if (timeout == 25) {
//         rpcResolver.forEach(function(rpc) {
//             rpc.reject("timed out");
//         });
//     }
//     timeout += 1;
// }, 1000);

// // ping sender
// setInterval(function() {
//     _ergo_rpc_call("ping", []).then(function() {
//         timeout = 0;
//     });
// }, 10000);
`

// client-facing ergo object API
const apiInject = `
// RPC set-up
var rpcUid = 0;
var rpcResolver = new Map();

window.addEventListener("message", function(event) {
    if (event.data.type == "connector_rpc_response") {
        console.log("page received from connector: " + JSON.stringify(event.data) + " with source = " + event.source + " and origin = " + event.origin);
        const rpcPromise = rpcResolver.get(event.data.uid);
        if (rpcPromise !== undefined) {
            const ret = event.data.return;
            if (ret.err !== undefined) {
                rpcPromise.reject(ret.err);
            } else {
                rpcPromise.resolve(ret.ok);
            }
        }
    }
});

class ErgoAPI {
    get_balance(token_id = 'ERG') {
        return this._ergo_rpc_call("get_balance", [token_id]);
    }

    sign_tx(tx) {
        return this._ergo_rpc_call("sign_tx", [tx]);
    }

    _ergo_rpc_call(func, params) {
        return new Promise(function(resolve, reject) {
            window.postMessage({
                type: "connector_rpc_request",
                uid: rpcUid,
                function: func,
                params: params
            }, "*");
            rpcResolver.set(rpcUid, { resolve: resolve, reject: reject });
            rpcUid += 1;
        });
    }
}

const ergo = Object.freeze(new ErgoAPI());
`

function injectIntoPage(code) {
    try {
        const container = document.head || document.documentElement;
        const scriptTag = document.createElement('script');
        scriptTag.setAttribute("async", "false");
        scriptTag.textContent = code;
        container.insertBefore(scriptTag, container.children[0]);
        container.removeChild(scriptTag);
        console.log("injection succeeded");
        return true;
    } catch (e) {
        console.log("injection failed: " + e);
        return false;
    }
}

injectIntoPage(initialInject);

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse)  {
    //alert("content script message: " + JSON.stringify(request));
    if (request.type == "yoroi_connected") {
        // inject full API here
        if (injectIntoPage(apiInject)) {
            chrome.runtime.sendMessage({type: "init_page_action"});
        } else {
            alert("failed to inject Ergo API");
            // TODO: return an error instead here if injection fails?
        }
        window.postMessage({
            type: "connector_connected",
            success: true
        }, "*");
    }
});

window.addEventListener("message", function(event) {
    if (event.data.type == "connector_rpc_request") {
        console.log("connector received from page: " + JSON.stringify(event.data) + " with source = " + event.source + " and origin = " + event.origin);
        chrome.runtime.sendMessage(
            yoroiExtensionId,
            event.data,
            {},
            function(response) {
                window.postMessage({
                    type: "connector_rpc_response",
                    uid: event.data.uid,
                    return: response
                }, "*");
            });
    } else if (event.data.type == "connector_connect_request") {
        // TODO: add timeout somehow?
        chrome.storage.local.get("whitelist", function(result) {
            let whitelist = Object.keys(result).length === 0 ? [] : result.whitelist;
            if (!whitelist.includes(location.hostname)) {
                if (confirm(`Allow access of ${location.hostname} to Ergo-Yoroi connector?`)) {
                    if (confirm(`Save ${location.hostname} to whitelist?`)) {
                        whitelist.push(location.hostname);
                        chrome.storage.local.set({whitelist: whitelist});
                    }
                    chrome.runtime.sendMessage(yoroiExtensionId, {type: "yoroi_connect_request"});
                } else {
                    // user refused - skip communication with Yoroi
                    window.postMessage({
                        type: "connector_connected",
                        success: false
                    }, "*");
                }
            } else {
                // already in whitelist
                chrome.runtime.sendMessage(yoroiExtensionId, {type: "yoroi_connect_request"});
            }
        });
    }
});