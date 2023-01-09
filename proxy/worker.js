/**
 * Author:    Mathias Nitzsche
 * Created:   2022-01-09
 * 
 * Simple CORS Proxy Service Worker - deployed as Cloudflare Worker
 * 
 * Usage: [DEPLOYMENT_LOCATION]?url=[proxyUrl]
 * Source: https://github.com/madmaxmatze/code/tree/main/proxy
 **/
addEventListener('fetch', event => event.respondWith(
  getUrlParam(event.request.url)
    .then(checkIfWhitelisted)
    .then(fetch)
    .then(checkFetchError)
    .then(extendResponseWithCorsHeader)
    .catch(handleError)
));

const getUrlParam = async (fullRequestUrl/*:string*/) => {
  try {
    return new URL((new URL(fullRequestUrl)).searchParams.get('url'));
  } catch (err) {
    throw URIError("?url= parameter is missing or invalid");
  }
};

const checkIfWhitelisted = async (url/*:URL*/) => {
  if (!["www.basketball-bund.net"].includes(url.hostname)) {
    throw URIError("Domain not whitelisted");
  }
  return url.href;
};

const checkFetchError = async (response) => {
  if (!response.ok) {
    throw Error(response.statusText);
  }
  return response;
};

const extendResponseWithCorsHeader = async (response) => {
  let mutableResponse = new Response(response.body, response);
  mutableResponse.headers.append("Access-Control-Allow-Origin", "*");
  return mutableResponse;
};

const handleError = async (error) => (
  new Response(error.toString(), {status: error instanceof URIError ? 400 : 500})
);
