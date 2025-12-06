require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dns = require('dns');
const urlParser = require('url');
const app = express();

// Basic Configuration
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.urlencoded({extended:true }));//Middleware to parse POST body
app.use(express.json());
app.use('/public', express.static(`${process.cwd()}/public`));

app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// Your first API endpoint
app.get('/api/hello', function(req, res) {
  res.json({ greeting: 'hello API' });
});

//1. Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(()=> console.log("Connected to MongoDB"))
  .catch((err)=> console.error("Connection Error:",err));

//Define the Schema
const urlSchema = new mongoose.Schema({
  original_url : {type: String, required: true},
  short_url : {type: Number, required: true, unique: true}
});

const Url = mongoose.model('Url' , urlSchema);

//API endpoint

//POST: Create a short URL
app.post('/api/shorturl', async function(req,res) {
  const originalUrl = req.body.url;

  //A. validate URL format
  let hostname;
  try {
    const parsedUrl = new URL(originalUrl);
    // FCC Requirement: The URL must allow http or https
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return res.json({ error: 'invalid url' });
    }
    hostname = parsedUrl.hostname;
  } catch (err) {
    return res.json({ error: 'invalid url' });
  }

  //B: Validate DNS
  dns.lookup(hostname, async (err, address) => {
    if (err || !address) {
      return res.json({ error: 'invalid url' });
    }

  //C: Check Database and Save
     try {
      const existingUrl = await Url.findOne({ original_url: originalUrl });
      
      if (existingUrl) {
        return res.json({ 
          original_url: existingUrl.original_url, 
          short_url: existingUrl.short_url 
        });
      }

      // Count documents to create a simple ID
      const count = await Url.countDocuments({});
      
      const newUrl = new Url({
        original_url: originalUrl,
        short_url: count + 1
      });

      const savedUrl = await newUrl.save();

      res.json({
        original_url: savedUrl.original_url,
        short_url: savedUrl.short_url
      });

    } catch (dbErr) {
      console.error(dbErr);
      res.status(500).json('Server Error');
    }
  });
});

//GET : Redirect to Original URL
app.get('/api/shorturl/:short_url', async function(req,res){
  const shortUrlParam = req.params.short_url;

  try {
    const foundUrl = await Url.findOne({ short_url: shortUrlParam });

    if (foundUrl) {
      return res.redirect(foundUrl.original_url);
    } else {
      return res.json({ error: 'No short URL found for the given input' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json('Server Error');
  }
})

app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});
