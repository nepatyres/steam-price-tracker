const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');
const Table = require('cli-table');

const appPassword = ''; // add your email app password from which nodemailer will send alerts. CREATE APP PASSWORD THROUGH GMAIL.
const email = ''; //add your email from which nodemailer will send alerts
const toEmail = ''; //add your email where you get alerts
const lots = [
    {
        name: '', //your track item name
        url: '', //your track item url
        alertPrice: 0, //price when you want to be alerted to email
        price: 'none' //don't touch this
    }, //you can create multiple objects to track item prices
];

let items = lots.map(lot => lot.price || 'none');

const fetchRate = async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('https://www.exchange-rates.org/current-rates/eur');
    const rate = await page.$$('.c a');
    const rateTexts = await Promise.all(rate.map(item => page.evaluate(el => el.innerText, item)));
    const currencies = {};

    try {
        for (let i = 0; i < rateTexts.length; i += 4) {
            const currency = rateTexts[i + 1].trim().split(' ')[0];
            const toEuro = rateTexts[i + 3].trim();
            currencies[currency] = { rate: toEuro };
        }
        await browser.close();
        return currencies;
    } catch (error) {
        console.error('error in fetchRate', error);
        await browser.close();
    }
}


const fetchPrices = async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    try {
        for (let i = 0; i < lots.length; i++) {
            if (items[i] === 'none') {
                await page.goto(lots[i].url, { waitUntil: 'domcontentloaded' });
                items[i] = await page.evaluate(() => {
                    const element = document.querySelector('.market_listing_price');
                    return element ? element.innerText : 'none';
                });
            }
        }
        await browser.close();

        if (items.includes('none')) {
            await fetchPrices();
        }

    } catch (error) {
        console.log('error fetching prices', error);
        await browser.close();
    }
    return items;
}


const price = (currencies, data) => {
    const table = new Table({
        head: ['Name', ...lots.map((lot) => `${lot.name}`)],
        style: { head: ['cyan'] }
    });
    const lotPrices = ['Price'];

    for (let i = 0; i < data.length; i++) {
        let currentData = data[i].charAt(data[i].length - 1) === '₴'
            ? (parseFloat(data[i].slice(0, -1).replace(',', '.').replace(/ /g, '')) * parseFloat(currencies.Ukraine.rate)).toFixed(2)
            : data[i].charAt(data[i].length - 1) === '₸'
                ? (parseFloat(data[i].slice(0, -1).replace(/ /g, '').replace(',', '.')) * parseFloat(currencies.Kazakhstan.rate)).toFixed(2)
                : data[i].substring(0, 2) === 'R$'
                    ? (parseFloat(data[i].replace(/^R\$ /, "").replace(',', '.').replace(/ /g, '')) * parseFloat(currencies.Brazilian.rate)).toFixed(2)
                    : data[i].charAt(data[i].length - 1) === '€'
                        ? data[i].replace(',', '.')
                        : data[i].slice(-4) === 'pуб.'
                            ? (parseFloat(data[i].slice(0, -4).replace(',', '.').replace(/ /g, '')) * parseFloat(currencies.Russian.rate)).toFixed(2)
                            : data[i].charAt(0) === '$'
                                ? (parseFloat(data[i].replace(/[$USD\s]/g, '').replace(',', '.').replace(/ /g, '')) * parseFloat(currencies.US.rate)).toFixed(2)
                                : data[i].slice(0, 4) === 'CDN$'
                                    ? (parseFloat(data[i].replace(/ /g, '').replace(/[CDN$\s]/g, '').replace(',', '.')) * parseFloat(currencies.Canadian.rate)).toFixed(2)
                                    : data[i].slice(0, 3) === 'S/.'
                                        ? (parseFloat(data[i].slice(3)) * 0.245).toFixed(2)
                                        : data[i].charAt(0) === '₹'
                                            ? (parseFloat(data[i].slice(1).replace(',', '.').replace(/ /g, '')) * parseFloat(currencies.Indian.rate)).toFixed(2)
                                            : data[i].charAt(0) === 'P'
                                                ? (parseFloat(data[i].slice(1).replace(',', '.').replace(/ /g, '')) * parseFloat(currencies.Philippine.rate)).toFixed(2)
                                                : data[i].charAt(0) === '¥'
                                                    ? (parseFloat(data[i].slice(1).replace(',', '.').replace(/ /g, '')) * parseFloat(currencies.Chinese.rate)).toFixed(2)
                                                    : data[i]
        currentData !== 'none' && currentData <= lots[i].alertPrice ? sendMessage(i) : '';
        currentData = currentData !== 'none' && currentData.charAt(data[i].length - 1) !== '€' ? currentData + '€' : currentData;
        lotPrices.push(currentData);
    }
    table.push(lotPrices);
    console.log(table.toString());
}

const transporter = nodemailer.createTransport({
    service: 'gmail',
    port: 465,
    secure: true,
    auth: {
        user: email,
        pass: appPassword
    },
    debug: true,
});

const sendMessage = (index) => {
    const mailOptions = {
        from: email,
        to: toEmail,
        subject: 'Price Alert',
        text: `check for ${lots[index].name}, ${lots[index].url}`
    };
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log('Error sending email:', error);
        } else {
            console.log('Email sent:', info.response);
        }
    });
}

const startFetching = async () => {
    try {
        const currencies = await fetchRate();
        const data = await fetchPrices();
        price(currencies, data);
        items = lots.map(() => 'none');
        const today = new Date();
        console.log(today.toString());
    } catch (error) {
        console.error('startFetching', error);
    }
}

startFetching();

setInterval(startFetching, 300000);