const fs = require("fs");
const path = require("path");
const request = require("request-promise");
const util = require("util");

const remoteDataManager = require("../build/remoteDataManager.js");

const exists = util.promisify(fs.exists);
const mkdir = util.promisify(fs.mkdir);
const writeFile = util.promisify(fs.writeFile);

var dcList;

module.exports = async () => {
    // Setup
    console.log("Downloading data...");
    const extendedHistoryFolder = path.join(__dirname, "../history");
    const listingFolder = path.join(__dirname, "../data");

    let itemTable = [];
    const dataFile = await request("https://raw.githubusercontent.com/xivapi/ffxiv-datamining/master/csv/Item.csv");

    let lines = dataFile.match(/[^\r\n]+/g).slice(3);
    for (let line of lines) {
        line = line.split(",");
        itemTable.push(line);
    }

    dcList = JSON.parse(await remoteDataManager.fetchFile("dc.json"));
    let worldMap = new Map();
    const worldDataCSV = (await remoteDataManager.fetchFile("World.csv")).toString();
    console.log("Populating tables...");
    let worldEntries = worldDataCSV.match(/[^\r\n]+/g).slice(3);
    for (let worldEntry of worldEntries) {
        worldEntry = worldEntry.split(",");
        if (worldEntry[0] > 16 && worldEntry[0] < 100) {
            worldMap.set(worldEntry[1].replace(/[^a-zA-Z]+/g, ""), worldEntry[0]);
        }
    }
    for (let dc in dcList) {
        if (dcList.hasOwnProperty(dc)) {
            worldMap.set(dc, dc);
        }
    }

    // Define functions to create folders
    async function createAllFoldersAndData(folderPath) {
        worldMap.forEach(async (value, key, map) => {
            let worldDirPath = path.join(folderPath, value);
            if (!await exists(worldDirPath)) await mkdir(worldDirPath);
            for (let item of itemTable) {
                if (!parseInt(item[0])) continue;
                let itemDirPath = path.join(worldDirPath, item[0]);
                if (!await exists(itemDirPath)) await mkdir(itemDirPath);
                let dataFilePath = path.join(itemDirPath, "0.json");
                await writeFile(dataFilePath,
                    JSON.stringify(await generateData({
                        propertyName: typeof value === 'number' ? "worldID" : "dcName",
                        value: key
                    }, item[0]))
                );
            }
        });
    }

    async function createAllFoldersAndExtendedData(folderPath) {
        worldMap.forEach(async (value, key, map) => {
            let worldDirPath = path.join(folderPath, value);
            if (!await exists(worldDirPath)) await mkdir(worldDirPath);
            for (let item of itemTable) {
                if (!parseInt(item[0])) continue;
                let itemDirPath = path.join(worldDirPath, item[0]);
                if (!await exists(itemDirPath)) await mkdir(itemDirPath);
                let dataFilePath = path.join(itemDirPath, "0.json");
                await writeFile(dataFilePath,
                    JSON.stringify(await generateExtendedData({
                        propertyName: typeof value === 'number' ? "worldID" : "dcName",
                        value: key
                    }, item[0]))
                );
            }
        });
    }

    console.log("Generating data...");
    let promises = [];
    promises.push(createAllFoldersAndExtendedData(extendedHistoryFolder));
    promises.push(createAllFoldersAndData(listingFolder));
    await Promise.all(promises);
    console.log("Done.");
};

async function generateExtendedData(nameObject, itemID) {
    let returnObject = {};
    returnObject[nameObject.propertyName] = nameObject.value;
    returnObject.itemID = itemID;
    returnObject.entries = [];
    let iterations = Math.floor(Math.random() * 400) + 100;
    for (let i = 0; i < iterations; i++) {
        returnObject.entries.push(await generateExtendedHistoryData(nameObject));
    }
    return returnObject;
}

async function generateData(nameObject, itemID) {
    let returnObject = {};
    returnObject[nameObject.propertyName] = nameObject.value;
    returnObject.itemID = itemID;
    returnObject.listings = [];
    returnObject.recentHistory = [];
    for (let i = 0; i < 2; i++) {
        let lastPrice = 0;
        let iterations = Math.floor(Math.random() * 12) + 8;
        for (let j = 3; j < iterations; j++) {
            if (i === 0) returnObject.listings.push(await generateListingData(nameObject, lastPrice));
            if (i === 1) returnObject.recentHistory.push(await generateHistoryData(nameObject));
        }
    }
    returnObject.listings = returnObject.listings.sort((a, b) => {
        if (a.pricePerUnit > b.pricePerUnit) return 1;
        if (a.pricePerUnit < b.pricePerUnit) return -1;
        return 0;
    });
    returnObject.recentHistory = returnObject.recentHistory.sort((a, b) => {
        if (a.pricePerUnit > b.pricePerUnit) return 1;
        if (a.pricePerUnit < b.pricePerUnit) return -1;
        return 0;
    });
    return returnObject;
}

async function generateListingData(nameObject = undefined, lastPrice) {
    let returnable = {
        hq: Math.floor(Math.random() * 2),
        materia: [],
        pricePerUnit: generatePrice(),
        quantity: Math.floor(Math.random() * 9) + 1,
        retainerName: makeid(10),
        retainerCity: (() => {
            let n = Math.floor(Math.random() * 6);
            switch(n){
                case 0: return "Gridania";
                case 1: return "Ul'dah";
                case 2: return "Limsa Lominsa";
                case 3: return "Ishgard";
                case 4: return "Kugane";
                case 5: return "Crystarium";
                default: return undefined;
            }
        })(),
        creatorName: makeid(10) + " " + makeid(10)
    };
    returnable["total"] = returnable.pricePerUnit * returnable.quantity;
    if (nameObject && dcList[nameObject.value]) {
        let worldList = dcList[nameObject.value];
        returnable.worldName = worldList[Math.floor(Math.random() * worldList.length)];
    }
    lastPrice = returnable.pricePerUnit;
    return returnable;
}

async function generateHistoryData(nameObject = undefined) {
    let returnable = {
        hq: Math.floor(Math.random() * 2),
        pricePerUnit: generatePrice(),
        quantity: Math.floor(Math.random() * 9) + 1,
        buyerName: makeid(10) + " " + makeid(10),
        timestamp: 1562090093 + Math.floor(Math.random() * (1567704760 - 1562090093))
    };
    returnable["total"] = returnable.pricePerUnit * returnable.quantity;
    if (nameObject && dcList[nameObject.value]) {
        let worldList = dcList[nameObject.value];
        returnable.worldName = worldList[Math.floor(Math.random() * worldList.length)];
    }
    return returnable;
}

async function generateExtendedHistoryData(nameObject = undefined) {
    let returnable = {
        hq: Math.floor(Math.random() * 2),
        pricePerUnit: generatePrice(),
        timestamp: 1562090093 + Math.floor(Math.random() * (1567704760 - 1562090093))
    };
    if (nameObject && dcList[nameObject.value]) {
        let worldList = dcList[nameObject.value];
        returnable.worldName = worldList[Math.floor(Math.random() * worldList.length)];
    }
    return returnable;
}

// https://stackoverflow.com/a/1349426
function makeid(length) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

function generatePrice(lastPrice = 0) {
    return Math.min(Math.floor(((input) => {
        return Math.pow(Math.E, Math.sqrt(input) / 540);
    })(Math.random() * 99999999 + 1)), 100000000);
}
