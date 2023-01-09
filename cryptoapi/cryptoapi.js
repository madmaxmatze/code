/**
 * Simple Crypto API
 * for Cloudflare Workers
 *
 * @author     Mathias Nitzsche
 * @date       2022-01-15
 * @usage      [TODO: Add link]
 * @reference  https://blog.api.rakuten.net/top-10-best-crypto-exchange-apis/
 */
    
const fetchConfig = {
  headers: {
    "content-type": "application/json;charset=UTF-8",
  },
  cf: {
    cacheTtl: 600,
    cacheEverything: true,
  },
};


/**
 * gatherResponse awaits and returns a response body as a string.
 * Use await gatherResponse(..) in an async function to get the response body
 * @param {Response} response
 */
async function gatherResponse(response) {
  const { headers } = response;
  const contentType = headers.get("content-type") || "";
  
  if (contentType.includes("application/json")) {
    return await response.json();
  } else {
    return response.text();
  }
}


/**
 * https://docs.kraken.com/rest/#operation/getTickerInformation
 * {
 *   "error": [],
 *   "result": {
 *     "SOLEUR": {
 *       "a": [
 *         "128.51000",
 *         "1",
 *         "1.000"
 *       ],
 *       "b": [
 *         "128.50000",
 *         "6",
 *         "6.000"
 *       ],
 *       "c": [
 *         "128.48000",   // last trade close = price
 *         "0.36713000"
 *       ],
 *       "v": [
 *         "9050.24598577",
 *         "49574.45903778"
 *       ],
 *       "p": [
 *         "128.58556",
 *         "131.60458"
 *       ],
 *       "t": [
 *         976,
 *         5233
 *       ],
 *       "l": [
 *         "126.38000",  // low today
 *         "126.38000"   // low 24h
 *       ],
 *       "h": [
 *         "131.22000",  // high today
 *         "137.60000".  // high 24h
 *       ],
 *       "o": "127.65000".  // open
 *     }
 *   }
 * }
 */
async function loadFromKraken(symbol) {
  var outputData = {};
  
  const url = "https://api.kraken.com/0/public/Ticker?pair=" + symbol;
  var response = await fetch(url, fetchConfig);
  var inputData = await gatherResponse(response);

  if (inputData.result) {
    outputData.symbol = symbol.toUpperCase();
    var resultObj = Object.values(inputData.result)[0];
    outputData.price = Number.parseFloat(resultObj["c"][0]);
    outputData.change = outputData.price - resultObj["o"];
    outputData.changepct = outputData.change / resultObj["o"];
    outputData.low = Number.parseFloat(resultObj["l"][0]);
    outputData.high = Number.parseFloat(resultObj["h"][0]);
  }

  return outputData;
}


/**
 * BINANCE {
 * "symbol": "SOLEUR",
 * "priceChange": "8.65000000",
 * "priceChangePercent": "6.855",
 * "weightedAvgPrice": "130.99489024",
 * "prevClosePrice": "126.18000000",
 * "lastPrice": "134.84000000",
 * "lastQty": "0.44000000",
 * "bidPrice": "134.89000000",
 * "bidQty": "4.81000000",
 * "askPrice": "134.93000000",
 * "askQty": "12.94000000",
 * "openPrice": "126.19000000",
 * "highPrice": "135.20000000",
 * "lowPrice": "125.53000000",
 * "volume": "38715.44000000",
 * "quoteVolume": "5071524.81330000",
 * "openTime": 1641993848201,
 * "closeTime": 1642080248201,
 * "firstId": 3812424,
 * "lastId": 3824052,
 * "count": 11629
 * }
 */
async function loadFromBinance(symbol) {
  var outputData = {};
  
  // Proxy needed because binance Cloudfront blocks requests from cloudflare
  const proxyhost = "http://api.scraperapi.com/?api_key=" + "[KEY]" + "&url=";
  const apiHost = "https://api.binance.com/api/v3/ticker/24hr?symbol=";

  var url = proxyhost + encodeURI(apiHost + symbol);

  const response = await fetch(url, fetchConfig);
  var inputData = await gatherResponse(response);

  if (inputData.symbol) {
    outputData.symbol = symbol.toUpperCase();
    outputData.price = inputData.lastPrice;
    outputData.change = inputData.priceChange;
    outputData.changepct = inputData.priceChangePercent;
    outputData.low = inputData.lowPrice;
    outputData.high = inputData.highPrice;
  }

  return outputData;
}


/**
 * https://docs.bitfinex.com/reference#rest-public-ticker
 * [[
 *   "tBTCEUR",   
 *   37429,              // BID, 
 *   16.48624778,        // BID_SIZE,
 *   37430,              // ASK, 
 *   21.601271940000004, // ASK_SIZE, 
 *   -881,               // DAILY_CHANGE,
 *   -0.023,             // DAILY_CHANGE_RELATIVE,
 *   37447,              // LAST_PRICE, 
 *   372.54212458,       // VOLUME, 
 *   38732,              // HIGH, 
 *   37136               // LOW
 * ]]
 */
async function loadFromBitfinex(symbol) {
  var outputData = {};
  
  const url = "https://api-pub.bitfinex.com/v2/tickers?symbols=t" + symbol;
  const response = await fetch(url, fetchConfig);
  var inputData = await gatherResponse(response);

  if (inputData[0]) {
    outputData.symbol = symbol.toUpperCase();
    outputData.change = inputData[0][5];
    outputData.changepct = inputData[0][6];
    outputData.price = inputData[0][7];
    outputData.high = inputData[0][9];
    outputData.low = inputData[0][10];
  }

  return outputData;
}


/**
 * Main
 */
async function handleRequest(request) {
  var resultString = "";
  let params = (new URL(request.url)).searchParams;
 
  // handle symbol
  var symbol = params.get('symbol');
  if (!symbol) {
    return new Response("Symbol parameter is missing.", {status: 400});
  }
  symbol = symbol.replace("CURRENCY:", "");

  // load crypto data
  var result = await loadFromKraken(symbol);
  if (!result) {
    result = await loadFromBitfinex(symbol);
  }
  if (!result || !Object.keys(result).length) {
    return new Response("Crypto not found", {status: 404});
  }
  
  // handle value
  var value = params.get('value'); 
  if (value) {
    if (!result.hasOwnProperty(value)) {
      return new Response("Value not found", {status: 412});
    }  
    resultString = result[value];
    
    // handle seperator
    if (params.get('seperator') == "comma") {
      resultString = String(resultString).replace(".", ",");
    }
  } else {
    resultString = JSON.stringify(result);
  }

  return new Response(resultString, fetchConfig);
}

addEventListener("fetch", event => {
  return event.respondWith(handleRequest(event.request))
})
