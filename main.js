//credits to https://intoli.com/blog/scrape-infinite-scroll/

const puppeteer = require('puppeteer');
const dotenv = require('dotenv');
const p_autoscroll = require('puppeteer-autoscroll-down');
const scrollPageToBottom = p_autoscroll.scrollPageToBottom;
const fs = require('fs');
const htmlToText = require('html-to-text');
var request = require('request');

dotenv.config({path: 'dot.env'});

const escapeXpathString = str => {
  const splitedQuotes = str.replace(/'/g, `', "'", '`);
  return `concat('${splitedQuotes}', '')`;
};

const clickByText = async (page, text) => {
  const escapedText = escapeXpathString(text);
  var linkHandlers = await page.$x(`//a[contains(text(), ${escapedText})]`);
  
  if (linkHandlers.length > 0) {
    await linkHandlers[0].click();
  } else {
	linkHandlers = await page.$x(`//a[href="./settings"]`);
	if(linkHandlers.length > 0) {
		await linkHandlers[0].click();
	}else{
		throw new Error(`Link not found: ${text}`);
	}
  }
};

function downloadImage(url) {
	return new Promise((resolve, reject) => {
			request(url, (error, response, body) => {
					if (error) reject(error);
					if (response.statusCode != 200) {
							reject('Invalid status code <' + response.statusCode + '>');
					}
		var encoded = "data:" + response.headers["content-type"] + ";base64," + new Buffer(body).toString('base64');
					resolve(encoded);
			});
	});
}

function delay(timeout) {
  return new Promise((resolve) => {
    setTimeout(resolve, timeout);
  });
}

async function scrapeInfiniteScrollItems(
  page,
  itemTargetCount,
  scrollDelay = 1000,
) {
  let items = [];
  try {
    let previousHeight;
	let controlText = await page.evaluate(() => document.querySelector('div[data-waitmessage]>div[role="heading"]').textContent);
	
    while (controlText!='Looks like you\'ve reached the end'){
      previousHeight = await page.evaluate('document.body.scrollHeight');
      await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
      await page.waitForFunction(`document.body.scrollHeight > ${previousHeight}`);
      await page.waitFor(scrollDelay);
    }
  } catch(e) { }
  return items;
}

(async () => {
    const browser = await puppeteer.launch({ headless: false })
    const page = await browser.newPage()
    
    await page.setViewport({ width: 1280, height: 800 })
    await page.goto('https://plus.google.com')
    
		await clickByText(page, `Sign in`);
    const navigationPromise = page.waitForNavigation()
    
    //page.waitForNavigation()
    await page.waitForSelector('input[type="email"]')
    await page.type('input[type="email"]', process.env.GOOGLE_USER)
    await page.click('#identifierNext')
    
    await page.waitForSelector('input[type="password"]', { visible: true })
    await page.type('input[type="password"]',process.env.GOOGLE_PWD)  
    
    await page.waitForSelector('#passwordNext', { visible: true })
    await page.click('#passwordNext')

		await page.waitForSelector('a[href="./settings"]')
		await delay(500);
		await page.click('a[href="./settings"]')
			
		navigationPromise
		await page.waitForSelector('a[href="./apps/activities"]')
		await page.click('a[href="./apps/activities"]')
		
		navigationPromise
		await page.goto('https://plus.google.com/apps/activities/plus_one_posts')
		
		//autoScroll(page);
		await scrapeInfiniteScrollItems(page, 100);
		let items = await page.$x(`//div[@role="listitem" and @tabindex=0]`);
		let images = await page.$x(`//div[@role="listitem" and @tabindex=0]/div[1]/img`);
		let contents = [];
		await console.log(`ITEMS => ${items.length}`);
		
		for (let i=0; i<items.length; i++) {
			let element = items[i];
			await console.log(i);
			
			let valueHandle = await images[i].getProperty('src');
			let linkText = await valueHandle.jsonValue();

			// first error scenario being handled
			await console.log(linkText);
			if(linkText == "")
				continue;
			
			await element.click();
			
			try{
				await page.waitForSelector('div[data-cai="undefined"]');
				let user_img = await page.$eval('div[data-ccsc] img', (el) => { return el.src});
				var dataimg = await downloadImage(user_img)
				console.log(dataimg);
			
				let user = await page.$eval('div[data-ccsc]>div a', (el) => { return el.innerText});
				let circle = await page.$eval('div[data-ccsc]>div>div a:nth-child(2)', (el) => { return el.innerHTML});
				let date = await page.$eval('div[data-ccsc]>div>a', (el) => { return el.innerText});
				let content = await page.$eval('div[data-cai="undefined"]', (el) => { return el.innerHTML});
				let data2 = await htmlToText.fromString(content);

				let item = new PlusItem(user, dataimg, circle, date, data2)

				await contents.push(item);
				await delay(500);
				await page.goBack();
				await page.waitFor(() => !document.querySelector('div[data-cai="undefined"]'));
			}catch(err){
				// second error scenario being handled
				await page.goBack();
				await page.waitFor(() => !document.querySelector('div[data-cai="undefined"]'));
				await scrapeInfiniteScrollItems(page, 100);
				items = await page.$x(`//div[@role="listitem" and @tabindex=0]`);
				images = await page.$x(`//div[@role="listitem" and @tabindex=0]/div[1]/img`);

				continue;
			}
		}
	
		//await console.log(contents);
		let x = await (async function() {
			let file = fs.writeFileSync('extracted.json', JSON.stringify(contents));
			//contents.forEach(function(v) { file.write(v + '\n'); });
			//file.write();
			//file.end();
		})();
	
  //await browser.close()
})()


class PlusItem {
  constructor(account, avatar, circle, date, content) {
		this.account = account;
		this.avatar = avatar;
		this.circle = circle;
		this.date = date;
		this.content = content;
  }
}