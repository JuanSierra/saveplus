//credits to https://intoli.com/blog/scrape-infinite-scroll/

const puppeteer = require('puppeteer');
const dotenv = require('dotenv');
const p_autoscroll = require('puppeteer-autoscroll-down');
const scrollPageToBottom = p_autoscroll.scrollPageToBottom;
const extractor = require('unfluff');
const fs = require('fs');
const htmlToText = require('html-to-text');

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

function delay(timeout) {
  return new Promise((resolve) => {
    setTimeout(resolve, timeout);
  });
}

Array.prototype.forEachAsync = async function(cb){
	for(let x of this){
		await cb(x);
	}
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
	
    while (controlText!='Looks like you\'ve reached the end'){//items.length < itemTargetCount) {
      previousHeight = await page.evaluate('document.body.scrollHeight');
      await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
      await page.waitForFunction(`document.body.scrollHeight > ${previousHeight}`);
      await page.waitFor(scrollDelay);
	  
	  //console.log(text);
	  ////const text = page.evaluate(() => document.querySelector('div[data-waitmessage]>div[role="heading"]').textContent);
    }
/*
	items = await page.evaluate(async () => {
		return await new Promise((resolve, reject) => {
			resolve(document.querySelectorAll('div[role="listitem"]'));
		});
		//console.log(color);
		//items.push(color);
		//page.goBack();
	});
	*/	  
		/*	
	page.evaluate(() => {
			console.log('before');
			
			elements[2].click();
			//console.log(elements);
			/*for (let element of elements){
				element.click();
				page.waitForSelector('div[data-cai="undefined"]');
				page.goBack();
			}
		 });
	  
	  for (let element of extractedElements) {
		  //console.log(element);
		  element.click();
		 // page.waitForSelector('div[data-cai="undefined"]');
		 // page.goBack();
		  await page.evaluate(async () => {
			  const color = await new Promise((resolve, reject) => {
				resolve($('div[data-cai="undefined"]').html());
			  });
			  console.log(color);
			  items.push(color);
			  page.goBack();
		  })
	  }
	  */
	
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
    
	//navigationPromise
	await page.waitForSelector('a[href="./settings"]')
	await page.click('a[href="./settings"]')
	
	navigationPromise
	await page.waitForSelector('a[href="./apps/activities"]')
	await page.click('a[href="./apps/activities"]')
	
	navigationPromise
	await page.goto('https://plus.google.com/apps/activities/plus_one_posts')
	
	//autoScroll(page);
	await scrapeInfiniteScrollItems(page, 100);
	let items = await page.$x(`//div[@role="listitem" and @tabindex=0]`);
	let contents = [];
	for (let element of items) {
		await element.click();
		await page.waitForSelector('div[data-cai="undefined"]');
		let content = await page.$eval('div[data-cai="undefined"]', (el) => { return el.innerHTML});
		let data = await extractor(content);
		let data2 = await htmlToText.fromString(content);
		await console.log(data);
		await console.log(data2);
		await contents.push(data);
		await delay(1000);
		await page.goBack();
		await page.waitFor(() => !document.querySelector('div[data-cai="undefined"]'));
	}
	//await console.log(contents);
	let x = await (async function() {
		let file = fs.createWriteStream('extracted.txt');
		file.on('error', function(err) { /* error handling */ });
		contents.forEach(function(v) { file.write(v.join(', ') + '\n'); });
		file.end();
	})();

	//await console.log(items);
	

	//console.log(items)
	//await page.screenshot({ path: path.normalize(`${__dirname}/example.png`) })
	
	//await console.log(items);
	//await page.goto('https://plus.google.com/apps/activities/plus_one_posts');//apps/activities
	//await page.screenshot({path: 'example.png'});
	
    //await browser.close()
})()

// posts comments sites