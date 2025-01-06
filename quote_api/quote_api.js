/**
 * Author:    Mathias Nitzsche
 * Created:   2022-01-11
 * 
 * Simple Stock/Crypto Quotes API
 * 
 * Usage: ?isin=IE000NFR7C63. ?currency=BTCEUR
 * Source: 
 **/
export default {
  /**
   * @param {any} request
   * @param {any} env
   */
  async fetch(request, env) {
    return handleRequest(request, env)
      .then(checkFetchError)
      .catch(handleError)
  }
}

const handleRequest = async (/** @type {{ url: any; }} */ request, /** @type {any} */ env) => {
  const urlParams = getUrlParams(request.url);

  const data = await loadDataFromProvider([
    [providerComdirect, urlParams.isin],
    [providerJustETF, urlParams.isin],
    [providerKraken, urlParams.currency],
    [providerBitfinex, urlParams.currency],
    [providerBinance, urlParams.currency],
  ], env);

  return generateResponse({ ...urlParams, ...data });
};

const getUrlParams = (/** @type {string | URL} */ url/*:string*/) => {
  const urlObj = new URL(url);
  var urlParams = Object.fromEntries(new URLSearchParams(urlObj.search));
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

const loadDataFromProvider = async (/** @type {((string | ((isin: any) => Promise<{ provider: string; price: any; change: any; changepct: number; }>))[] | (string | ((currency: any, env: any) => Promise<{ provider: string; price: any; change: any; changepct: any; low: any; high: any; }>))[])[]} */ provider, /** @type {any} */ env) => {
  for (const [func, param] of provider) {
    if (typeof func === 'function' && param) {
      const result = await func(param, env);
      if (result || Object.keys(result).length) {
        return result;
      }
    }
  }

  throw URIError("No data found");
};

/**
 * 
 */
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

const fetchResponse = async (url, fetchConfig = null) => {
  const response = await fetch(url, fetchConfig);
  const { headers } = response;
  const contentType = headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return await response.json();
  } else {
    return await response.text();
  }
}

const cacheFetchConfig = {
  headers: {
    "content-type": "application/json;charset=UTF-8",
  },
  cf: {
    cacheTtl: 600,
    cacheEverything: true,
  },
};










/**
 * **********************************************************************
 * Provider
 ************************************************************************/
 


/** Comdirect.de ****************************************************
 * <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" soap:encodingStyle="http://www.w3.org/2001/12/soap-encoding">
 * <soap:Body>
 * <response>
 *   <replaceelement id="keyelement_kurs_update">
 *     <![CDATA[ <div [..HTML..] > 5.139 </com-push-text [..HTML..] > 0,039 </com-push-text [..HTML..] > +0,002 </com-push-text [..HTML..] > ]]>
 *   </replaceelement>
 * </response>
 * </soap:Body>
 * </soap:Envelope>
 * 
 * @param {String} isin
 */
async function providerComdirect(isin) {
  if (!isin) {
    return;
  }

  const data = await fetchResponse(`https://www.comdirect.de/inf/snippet$lsg.ewf.keyelement.general_price_update.ajax?ISIN=${isin}`);

  if (data) {
    var matches = data.match(/^\s+([\d-+.,]+)\s*$/gm)    // match numbers alone in a line
      .map((/** @type {string} */ match) => match.trim())
      .map((/** @type {string} */ num, /** @type {any} */ index) =>
        parseFloat(index
          ? num.replace('.', '').replace(',', '.')      // German parsing
          : num                                         // First item is parsed as-is
        )
      );

    return {
      provider: "comdirect.de",
      price: matches[0],
      change: matches[2],
      changepct: matches[1] / 100,
    };
  }
}


/** JustETF.com ****************************************************
 * <ETFQuoteResponse>
 * <latestQuote>
 *   <raw>3.69</raw>
 *   <localized>3,69</localized>
 * </latestQuote>
 * <latestQuoteDate>2025</latestQuoteDate>
 * <latestQuoteDate>1</latestQuoteDate>
 * <latestQuoteDate>6</latestQuoteDate>
 * <previousQuote>
 *   <raw>3.68</raw>
 *   <localized>3,68</localized>
 * </previousQuote>
 * <previousQuoteDate>2025</previousQuoteDate>
 * <previousQuoteDate>1</previousQuoteDate>
 * <previousQuoteDate>3</previousQuoteDate>
 * <dtdPrc>
 *   <raw>0.27</raw>
 *   <localized>0,27</localized>
 * </dtdPrc>
 * <dtdAmt>
 *   <raw>0.01</raw>
 *   <localized>0,01</localized>
 * </dtdAmt>
 * <quoteTradingVenue>XETRA</quoteTradingVenue>
 * <quoteLowHigh>
 *   <low>
 *     <raw>2.76</raw>
 *     <localized>2,76</localized>
 *   </low>
 *   <high>
 *     <raw>4.03</raw>
 *     <localized>4,03</localized>
 *   </high>
 * </quoteLowHigh>
 * </ETFQuoteResponse>
 * 
 * @param {String} isin
 */
async function providerJustETF(isin) {
  if (!isin) {
    return;
  }

  const data = await fetchResponse(`https://www.justetf.com/api/etfs/${isin}/quote?currency=EUR&locale=de`, cacheFetchConfig);

  if (data && data.latestQuote) {
    return {
      provider: "justetf.com",
      price: data.latestQuote.raw,
      change: data.dtdAmt.raw,
      changepct: data.dtdPrc.raw / 100,
    };
  }
}


/** kraken.com ****************************************************
 * https://docs.kraken.com/rest/#operation/getTickerInformation
 * {
 *  "error": [],
 *  "result": {
 *    "SOLEUR": {
 *      "a": [
 *        "128.51000",
 *        "1",
 *        "1.000"
 *      ],
 *      "b": [
 *        "128.50000",
 *        "6",
 *        "6.000"
 *      ],
 *      "c": [
 *        "128.48000",   // last trade close = price
 *        "0.36713000"
 *      ],
 *      "v": [
 *        "9050.24598577",
 *        "49574.45903778"
 *      ],
 *      "p": [
 *        "128.58556",
 *        "131.60458"
 *      ],
 *      "t": [
 *        976,
 *        5233
 *      ],
 *      "l": [
 *        "126.38000",  // low today
 *        "126.38000"   // low 24h
 *      ],
 *      "h": [
 *        "131.22000",  // high today
 *        "137.60000".  // high 24h
 *      ],
 *      "o": "127.65000".  // open
 *    }
 *  }
 * }
 * @param {String} currency
 */
async function providerKraken(currency) {
  const data = await fetchResponse(`https://api.kraken.com/0/public/Ticker?pair=${currency}`, cacheFetchConfig);

  if (data && data.result) {
    const resultObj = Object.values(data.result)[0];
    const openPrice = Number.parseFloat(resultObj["o"]);
    const currentPrice = Number.parseFloat(resultObj["c"][0])

    return {
      provider: "kraken.com",
      price: currentPrice,
      change: currentPrice - openPrice,
      changepct: (currentPrice - openPrice) / openPrice,
      low: Number.parseFloat(resultObj["l"][0]),
      high: Number.parseFloat(resultObj["h"][0]),
    };
  }
}


/** BINANCE.com ****************************************************
 * https://blog.api.rakuten.net/top-10-best-crypto-exchange-apis/
 * 
 * {
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
 * 
 * @param {string} currency
 * @param {{ SCRAPERAPI_KEY: any; }} env  
 * https://developers.cloudflare.com/workers/runtime-apis/handlers/fetch/#parameters
 */
async function providerBinance(currency, env) {
  // Proxy needed because binance Cloudfront blocks requests from cloudflare
  const url = `http://api.scraperapi.com/?api_key=${env.SCRAPERAPI_KEY}&url=` +
    encodeURI(`https://api.binance.com/api/v3/ticker/24hr?symbol=${currency}`);

  const data = await fetchResponse(url, cacheFetchConfig);

  if (data && data.lastPrice) {
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


/** bitfinex.com ****************************************************
 * https://docs.bitfinex.com/reference#rest-public-ticker
 * [[
 *  "tBTCEUR",   
 *  37429,              // BID, 
 *  16.48624778,        // BID_SIZE,
 *  37430,              // ASK, 
 *  21.601271940000004, // ASK_SIZE, 
 *  -881,               // DAILY_CHANGE,
 *  -0.023,             // DAILY_CHANGE_RELATIVE,
 *  37447,              // LAST_PRICE, 
 *  372.54212458,       // VOLUME, 
 *  38732,              // HIGH, 
 *  37136               // LOW
 * ]]
 * @param {String} currency
 */
async function providerBitfinex(currency) {
  const data = await fetchResponse(`https://api-pub.bitfinex.com/v2/tickers?symbols=t${currency}`, cacheFetchConfig);

  if (data && data[0]) {
    return {
      provider: "bitfinex.com",
      change: data[0][5],
      changepct: data[0][6],
      price: data[0][7],
      high: data[0][9],
      low: data[0][10],
    };
  }
}
