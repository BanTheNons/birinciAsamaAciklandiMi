const axios = require('axios').default
const puppeteer = require('puppeteer')
const FormData = require('form-data')
const { WebhookClient } = require('discord.js')
require('dotenv').config()

const client = process.env.MAIN_WEBHOOK_ID ? new WebhookClient({ id: process.env.MAIN_WEBHOOK_ID, token: process.env.MAIN_WEBHOOK_TOKEN }) : null
const privateClient = process.env.PRIVATE_WEBHOOK_ID ? new WebhookClient({ id: process.env.PRIVATE_WEBHOOK_ID, token: process.env.PRIVATE_WEBHOOK_TOKEN }) : null

const ocr = async image => {
    const formData = new FormData()
    formData.append('base64Image', image)
    formData.append('scale', 'true')
    formData.append('OCREngine', '2')
    const response = axios({
        method: 'POST',
        url: 'https://api.ocr.space/parse/image',
        headers: {
            'Content-Type': 'multipart/form-data',
            apikey: process.env.OCR_SPACE_API_KEY
        },
        data: formData
    });
    return (await response).data.ParsedResults[0].ParsedText.replace(/[^a-zA-Z0-9]/g, '')
}

let page = new puppeteer.Page()
const main = async () => {
    console.log(new Date(Date.now()+1.08e+7).toUTCString())
    try {
        const response = page.waitForResponse(response => response.url().includes('dogrula.jpg'))
        await page.goto('https://ebideb.tubitak.gov.tr/olimpiyatSinavSonucSistemi.htm?KeepThis=true')
        const buffer = await (await response).buffer()
        const image = 'data:image/jpg;base64,' + buffer.toString('base64')
        await page.setViewport({width: 1024, height: 1080});
        await Promise.all([
            page.type('#tcKimlikNo.form-control', process.env.TC_KIMLIK),
            page.select('#cmbSinavYili.form-control', '2022'),
            page.select('#cmbOlimpiyatDal.form-control', '7'),
            page.select('#cmbOlimpiyatSinavTuru.form-control', '1')
        ])
        await page.type('#guvenlik.textThick', await ocr(image))
        const [afterNavigation] = await Promise.all([
            page.waitForNavigation(),
            page.click('#sonucBilgileriniGetir.btn')
        ]);
        const released = await afterNavigation.text()
        if (released.includes('TEST SINAVI SONUÇLARI')) {
            console.log('açıklandı')
            if (process.env.PRIVATE_WEBHOOK_ID) {
                await page.screenshot({ path: 'page.png', fullPage: true });
                await privateClient.send({
                    content: '@everyone',
                    allowedMentions: {parse: ['everyone']},
                    files: ['page.png']
                })
            }
            if (process.env.MAIN_WEBHOOK_ID) {
                await client.send({
                    content: '@everyone açıklandı',
                    allowedMentions: {parse: ['everyone']},
                })
            }
            process.exit(0)
        }
        else {
            if (process.env.MAIN_WEBHOOK_ID) {
                await client.send({
                    content: 'oh...'
                })
            }
        }
    } catch (err) {
        console.error(err)
    }
}

(async () => {
    const browser = await puppeteer.launch({headless: 'new', args: ['--no-sandbox']})
    page = await browser.newPage()
    setInterval(main, 60000)
})()
