/**
 * Author:    Mathias Nitzsche
 * Created:   2022-01-11
 * 
 * API to fetch quotes
 * 
 * Usage: https://api.peerfol.io/quote?isin=IE000NFR7C63    ?currency=CURRENCY:BTCEUR    ?symbol=[currently or isin]
 * Source: https://github.com/madmaxmatze/code/
 **/
addEventListener('fetch', event => event.respondWith(
  handleRequest(event.request)
    .then(checkFetchError)
    .catch(handleError)
));

const handleRequest = async (request/*:Request*/) => {
  var urlParams = getUrlParams(request.url);

  var data = await loadDataFromProvider([
    [providerComdirect, urlParams.isin],
    [providerJustETF, urlParams.isin],
    [providerKraken, urlParams.currency],
    [providerBitfinex, urlParams.currency],
  ]);

  return generateResponse({ ...urlParams, ...data });
};

const getUrlParams = (urlString/*:string*/) => {
  var url = new URL(urlString);
  var urlParams = Object.fromEntries(new URLSearchParams(url.search));
  if (urlParams.symbol) {
    if (!urlParams.isin && urlParams.symbol.match(/^[A-Z]{2}\w{8}\d{2}$/)) {
      urlParams.isin = urlParams.symbol;
    }
    if (!("currency" in urlParams) && urlParams.symbol.match(/^CURRENCY\:[A-Z]{6}$/)) {
      urlParams.currency = urlParams.symbol;
    }
    delete urlParams.symbol;
  }
  if (urlParams.currency) {
    urlParams.currency = urlParams.currency.replace("CURRENCY:", "").toUpperCase();
  }

  return urlParams;
}

const loadDataFromProvider = async (provider) => {
  for (const [func, param] of provider) {
    if (typeof func === 'function' && param) {
      const result = await func(param);
      if (result || Object.keys(result).length) {
        return result;
      }
    }
  }

  throw URIError("No data found");
};

const generateResponse = (data) => {
  return new Response(
    data.format === 'csv' ?
      data.price + ";" + data.changepct
      :
      JSON.stringify(data)
  );
};

const checkFetchError = async (response) => {
  if (!response.ok) {
    throw Error(response.statusText);
  }
  return response;
};

const handleError = async (error) => (
  new Response(error.toString(), { status: error instanceof URIError ? 400 : 500 })
);










/************************************************************************
 * Provider
 ***********************************************************************/
async function providerComdirect(isin/*:string*/) {
  if (!isin) {
    return;
  }

  var response = await fetch(`https://www.comdirect.de/inf/snippet$lsg.ewf.keyelement.general_price_update.ajax?ISIN=${isin}`);
  var xml = await response.text();

  if (!xml) {
    return;
  }

  var matches = xml.match(/^\s+([\d-+.,]+)\s*$/gm)    // match numbers alone in a line
    .map(match => match.trim())                       // trim
    .map((num, index) =>
      parseFloat(index
        ? num.replace('.', '').replace(',', '.')      // German parsing
        : num                                         // First item is parsed as-is
      )
    );

  return {
    provider: "comdirect.com",
    price: matches[0],
    change: matches[2],
    changepct: matches[1] / 100,
  };
}

async function providerJustETF(isin/*:string*/) {
  if (!isin) {
    return;
  }

  var response = await fetch(`https://www.justetf.com/api/etfs/${isin}/quote?currency=EUR&locale=de`);
  var json = await response.json();

  if (json && json.latestQuote) {
    return {
      provider: "justetf.com",
      price: json.latestQuote.raw,
      change: json.dtdAmt.raw,
      changepct: json.dtdPrc.raw / 100,
    };
  }
}

/**
 * Simple Crypto API
 * for Cloudflare Workers
 *
 * @author     Mathias Nitzsche
 * @date       2022-01-15
 * @usage      [TODO: Add link]
 * reference   https://blog.api.rakuten.net/top-10-best-crypto-exchange-apis/
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
    return await response.text();
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
async function providerKraken(currency/*:string*/) {
  var response = await fetch(`https://api.kraken.com/0/public/Ticker?pair=${currency}`, fetchConfig);
  var data = await gatherResponse(response);

  if (data.result) {
    var resultObj = Object.values(data.result)[0];
    var returnVal = {
      provider: "kraken.com",
      price: Number.parseFloat(resultObj["c"][0]),
      low: Number.parseFloat(resultObj["l"][0]),
      high: Number.parseFloat(resultObj["h"][0]),
    };
    returnVal.change = (returnVal.price - resultObj["o"]);
    returnVal.changepct = (returnVal.change / resultObj["o"]);
    return returnVal;
  }
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
async function providerBinance(currency/*:string*/) {
  // Proxy needed because binance Cloudfront blocks requests from cloudflare
  var url = "http://api.scraperapi.com/?api_key=" + "[KEY]" + "&url=" +
    encodeURI(`https://api.binance.com/api/v3/ticker/24hr?symbol=${currency}`);

  const response = await fetch(url, fetchConfig);
  var data = await gatherResponse(response);

  if (data.currency) {
    return {
      provider: "binance.com",
      price: data.lastPrice,
      change: data.priceChange,
      changepct: data.priceChangePercent,
      low: data.lowPrice,
      high: data.highPrice,
    }
  }
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
async function providerBitfinex(currency/*:string*/) {
  const response = await fetch(`https://api-pub.bitfinex.com/v2/tickers?symbols=t${currency}`, fetchConfig);
  var data = await gatherResponse(response);

  if (data[0]) {
    return {
      provider: "bitfinex.com",
      change: data[0][5],
      changepct: data[0][6],
      price: data[0][7],
      high: data[0][9],
      low: data[0][10],
    }
  }
}
