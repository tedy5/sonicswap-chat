// Define the type for market data parameters
type MarketDataParams = {
  symbol: string;
  indicators?: ('rsi' | 'macd' | 'ema' | 'sma' | 'bollinger' | 'volume')[];
};

// Define the structure of a candle based on the actual data format
export type Candle = {
  interval_start: string;
  open_price: string;
  high_price: string;
  low_price: string;
  close_price: string;
  buy_volume_usd: string;
  sell_volume_usd: string;
  buy_count: number;
  sell_count: number;
};

// Define the structure of indicator data
export type IndicatorData = {
  name: string;
  values: number[] | { [key: string]: number[] };
};

// Define the structure of market data response directly matching the API response
export type MarketData = {
  daily: Candle[];
  fourHourly: Candle[];
  hourly: Candle[];
  fiveMin: Candle[];
  indicators?: {
    daily?: IndicatorData[];
    fourHourly?: IndicatorData[];
    hourly?: IndicatorData[];
    fiveMin?: IndicatorData[];
  };
};

export async function fetchMarketData(params: MarketDataParams): Promise<MarketData> {
  const apiUrl = process.env.MARKET_DATA_API_URL;
  const apiKey = process.env.MARKET_DATA_API_KEY;

  if (!apiUrl || !apiKey) {
    throw new Error('Market data API configuration is missing');
  }

  try {
    // Construct the query parameters
    const queryParams = new URLSearchParams();
    queryParams.append('address', params.symbol);

    if (params.indicators && params.indicators.length > 0) {
      queryParams.append('indicators', params.indicators.join(','));
    }

    // Make the API request
    const response = await fetch(`${apiUrl}/api/token-data?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    // Validate the response structure
    if (!data.daily || !data.fourHourly || !data.hourly || !data.fiveMin) {
      throw new Error('Invalid market data response format');
    }

    return data as MarketData;
  } catch (error) {
    console.error('Error fetching market data:', error);
    throw error instanceof Error ? error : new Error('Failed to fetch market data');
  }
}
