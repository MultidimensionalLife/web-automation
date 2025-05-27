import puppeteer from "puppeteer";
import { createCursor } from "ghost-cursor";
import md5 from "md5";
import axios from "axios";
import { select, input } from "@inquirer/prompts";
import fs from "fs";

import { installMouseHelper } from "./install-mouse-helper.js";

const HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
};

const acc_info = {
  email: process.env.ACCT_INFO_EMAIL,
  password: md5(process.env.ACCT_INFO_PASS),
};

async function get_token() {
  const signIn_URL = process.env.ACCT_SIGNIN_URL;
  try {
    const response = await axios.post(signIn_URL, acc_info, {
      headers: HEADERS,
    });
    return response.data.data.token;
  } catch (error) {
    console.log(error.message);
    console.log("Response data:", error.response.data);
    return false;
  }
}

async function getByAxios(folder_id, profile_id) {
  const token = await get_token();

  if (!token) return null;

  HEADERS.Authorization = "Bearer " + token;

  const profileLaunch_URL = `https://launcher.mlx.yt:45001/api/v2/profile/f/${folder_id}/p/${profile_id}/start?automation_type=puppeteer&headless_mode=false`;

  try {
    const response = await axios.get(profileLaunch_URL, {
      headers: HEADERS,
    });

    const browserURL = `http://127.0.0.1:${response.data.data.port}`;

    const browser = await puppeteer.connect({
      browserURL: browserURL,
      timeout: 10000,
      defaultViewport: {
        width: 1080,
        height: 1024,
      },
    });

    return browser;
  } catch (e) {
    console.log("error", e);
    return null;
  }
}

async function navigator() {
  const browser = await getByAxios(
    process.env.FOLDER_ID,
    process.env.PROFILE_ID
  );

  if (!browser) {
    return;
  }

  const page = await browser.newPage();

  await page.goto(process.env.WEBSITE_URL_INSPECT);

  await page.locator(".menuitem_cat").click();

  await page.locator(".readmore").click();

  await browser.close();
}

function delay(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time);
  });
}

async function bingSearch(keyword = process.env.BING_SEARCH_TERM) {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: {
      width: 2000,
      height: 1500,
    },
  });

  const page = await browser.newPage();

  await installMouseHelper(page);

  await page.goto(`https://bing.com/search?q=${encodeURI(keyword)}`);

  const selector = "#b_results li:nth-child(2) div a";

  await page.waitForSelector(selector);

  const cursor = createCursor(page);

  await cursor.move(selector);

  const newPagePromise = new Promise((resolve) =>
    browser.once("targetcreated", (target) => resolve(target.page()))
  );

  await cursor.click();

  const newPage = await newPagePromise;

  await newPage.evaluate(() => {
    const scrollHeight = document.body.scrollHeight;
    const randomScroll = Math.floor(Math.random() * scrollHeight);
    window.scrollTo(0, randomScroll);
  });

  // await cursor.click(selector).then(() => page.waitForNavigation({waitUntil: 'load'}));

  // await page.click(selector).then(() => page.waitForNavigation());

  // await Promise.all([
  //   page.waitForNavigation(),
  //   page.click(selector)
  // ]);

  // await page.evaluate(() => {
  //   document.querySelector("#b_results li:nth-child(2) div a").click();
  // });

  // await page.waitForNavigation({ waitUntil: "load" });

  // console.log("LOADED");

  // const page3 = pages[2];

  // await page3.evaluate(() => {
  //   window.scrollTo(100, 500);
  // });

  // await installMouseHelper(page3);

  //  const cursor3 = createCursor(page3);

  //  await cursor3.scroll({ x: 100, y: 100 });
}

async function surfer(
  profile_id = process.env.PROFILE_ID,
  folder_id = process.env.FOLDER_ID
) {
  // const browser = await getByAxios(folder_id, profile_id);

  // if (!browser) {
  //   return;
  // }

  const browser = await puppeteer.launch({ headless: false });

  const page = await browser.newPage();

  console.log("Using profile: ", profile_id);

  await page.goto(process.env.WEBSITE_URL_SURFER, {
    timeout: 60000,
    waitUntil: "domcontentloaded",
  });

  const element = await page.waitForSelector(
    ".trendingPosts_trendingPosts__aTdra li:nth-child(2) a"
  );

  element.click();

  await page.evaluate(() => {
    const scrollHeight = document.body.scrollHeight;
    const randomScroll = Math.floor(Math.random() * scrollHeight);
    window.scrollTo(0, randomScroll);
  });
}

async function multipleSurfer() {
  fs.readFile("profiles.json", async function (err, data) {
    if (err) throw err;

    const profiles = JSON.parse(data);

    for (let i = 0; i < profiles.length; i++) {
      await surfer(profiles[i].profile_id, profiles[i].folder_id);
    }
  });
}

const selected = await select({
  message: "Select a script to run",
  choices: [
    {
      name: "navigator",
      value: "navigator",
      description: "Navigate specific website",
    },
    {
      name: "bingsearch",
      value: "bingsearch",
      description: "Bing Search",
    },
    {
      name: "selected_by_profile",
      value: "selected_by_profile",
      description: "Navigate by profile id",
    },
    {
      name: "surfer",
      value: "surfer",
      description: "Navigate and Scroll",
    },
    {
      name: "multiple_surfer",
      value: "multiple_surfer",
      description: "Navigate and Scroll for multiple users",
    },
  ],
});

if (selected === "navigator") {
  navigator();
} else if (selected === "bingsearch") {
  const keyword = await input({ message: "Enter Keyword" });

  if (!keyword) {
    console.log("Using default keyword");
    bingSearch();
  } else {
    bingSearch(keyword);
  }
} else if (selected === "surfer") {
  surfer();
} else if (selected === "multiple_surfer") {
  multipleSurfer();
} else if (selected === "selected_by_profile") {
  const profile = await input({ message: "Enter Profile ID" });

  if (profile) {
    surfer(profile);
  }
} else {
  console.log("No script selected");
}
