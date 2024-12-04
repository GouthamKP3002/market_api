require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const validTypes = ["state", "district", "commodity", "market"];

app.get("/api/commodities", (req, res) => {
  // Ensure you're using the correct data loading method
  const commodityData = loadData(); // Or however you're loading data

  // Default to returning all records if no filters
  let filteredRecords = commodityData.records || [];

  // Optional: Add logging
  console.log(`Total records: ${filteredRecords.length}`);

  res.json({
    total: filteredRecords.length,
    records: filteredRecords,
  });
});

app.get("/", (req, res) => {
  res.json({
    message: "Mandi Price API is running",
    endpoints: [
      "/api/commodities/state/Karnataka",
      " /api/commodities/state/Karnataka/district/Bangalore",
      "/api/commodities/state/Karnataka/commodity/Rice",
      "/api/commodities/state/Karnataka/market/Central Market",
    ],
  });
});

const loadData = () => {
  try {
    const rawData = fs.readFileSync(
      path.resolve(__dirname, "mandi_prices.json")
    );
    return JSON.parse(rawData);
  } catch (error) {
    console.error("Error loading data:", error);
    return { records: [] };
  }
};

const data = loadData();

app.get(
  "/api/commodities/:type1/:value1/:type2?/:value2?/:type3?/:value3?/:type4?/:value4?",
  (req, res) => {
    const { type1, value1, type2, value2, type3, value3, type4, value4 } =
      req.params;
    const { state, district, commodity, market } = req.query;

    let filteredRecords = data.records;

    // If only state is provided, filter only by state
    if (type1 === "state" && value1 && !type2) {
      filteredRecords = filteredRecords.filter((record) =>
        record.state
          .toLowerCase()
          .includes(decodeURIComponent(value1).toLowerCase())
      );
    } else {
      // Existing nested filtering logic
      const paramFilters = [
        { type: type1, value: value1 },
        { type: type2, value: value2 },
        { type: type3, value: value3 },
        { type: type4, value: value4 },
      ].filter((filter) => filter.type && filter.value);

      paramFilters.forEach((filter) => {
        if (!validTypes.includes(filter.type)) {
          return res.status(400).json({
            error: "Invalid type",
            validTypes: validTypes,
          });
        }

        filteredRecords = filteredRecords.filter((record) =>
          record[filter.type]
            .toLowerCase()
            .includes(decodeURIComponent(filter.value).toLowerCase())
        );
      });
    }

    if (state) {
      filteredRecords = filteredRecords.filter(
        (record) => record.state.toLowerCase() === state.toLowerCase()
      );
    }

    if (district) {
      filteredRecords = filteredRecords.filter(
        (record) => record.district.toLowerCase() === district.toLowerCase()
      );
    }

    if (commodity) {
      filteredRecords = filteredRecords.filter(
        (record) => record.commodity.toLowerCase() === commodity.toLowerCase()
      );
    }

    if (market) {
      filteredRecords = filteredRecords.filter(
        (record) => record.market.toLowerCase() === market.toLowerCase()
      );
    }

    res.json({
      total: filteredRecords.length,
      records: filteredRecords,
    });
  }
);

app.get(
  "/api/commodity/:type1/:value1/:type2?/:value2?/:type3?/:value3?/:type4?/:value4?",
  (req, res) => {
    const { type1, value1, type2, value2, type3, value3, type4, value4 } =
      req.params;
    const validTypes = ["state", "district", "commodity", "market"];

    let filteredRecords = data.records;

    const paramFilters = [
      { type: type1, value: value1 },
      { type: type2, value: value2 },
      { type: type3, value: value3 },
      { type: type4, value: value4 },
    ].filter((filter) => filter.type && filter.value);

    paramFilters.forEach((filter) => {
      if (!validTypes.includes(filter.type)) {
        return res.status(400).json({
          error: "Invalid type",
          validTypes: validTypes,
        });
      }

      filteredRecords = filteredRecords.filter(
        (record) =>
          record[filter.type].toLowerCase() ===
          decodeURIComponent(filter.value).toLowerCase()
      );
    });

    if (filteredRecords.length === 0) {
      return res.status(404).json({ error: "No matching records found" });
    }

    res.json(filteredRecords);
  }
);

app.get("/api/unique/:type?", (req, res) => {
  const { type } = req.params;

  const uniqueOptions = {
    states: [...new Set(data.records.map((record) => record.state))],
    districts: [...new Set(data.records.map((record) => record.district))],
    commodities: [...new Set(data.records.map((record) => record.commodity))],
    markets: [...new Set(data.records.map((record) => record.market))],
  };

  if (!type || !uniqueOptions[type]) {
    return res.status(200).json({
      availableTypes: Object.keys(uniqueOptions),
      data: uniqueOptions,
    });
  }

  res.json({
    [type]: uniqueOptions[type],
  });
});

app.get("/api/stats/:commodity?", (req, res) => {
  const { commodity } = req.params;

  let commodityRecords = data.records;

  if (commodity) {
    commodityRecords = commodityRecords.filter(
      (record) =>
        record.commodity.toLowerCase() ===
        decodeURIComponent(commodity).toLowerCase()
    );
  }

  if (commodityRecords.length === 0) {
    return res
      .status(404)
      .json({ error: "No records found for this commodity" });
  }

  const stats = {
    totalRecords: commodityRecords.length,
    uniqueCommodities: [...new Set(commodityRecords.map((r) => r.commodity))],
    priceStats: {
      minPrice: Math.min(...commodityRecords.map((r) => r.min_price)),
      maxPrice: Math.max(...commodityRecords.map((r) => r.max_price)),
      avgModalPrice:
        commodityRecords.reduce((sum, r) => sum + r.modal_price, 0) /
        commodityRecords.length,
    },
    topMarkets: commodityRecords
      .sort((a, b) => b.modal_price - a.modal_price)
      .slice(0, 5),
    statewise: commodityRecords.reduce((acc, record) => {
      if (!acc[record.state]) acc[record.state] = [];
      acc[record.state].push(record);
      return acc;
    }, {}),
  };

  res.json(stats);
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Something went wrong!",
    message: err.message,
  });
});

app.listen(PORT, () => {
  console.log(`Mandi Price API running on port ${PORT}`);
});

module.exports = app;
