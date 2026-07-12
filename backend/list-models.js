require('dotenv').config();

async function listModels() {
  try {
    let url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}&pageSize=100`;
    let res = await fetch(url);
    let data = await res.json();
    let allModels = [...data.models];
    
    while(data.nextPageToken) {
       let nUrl = url + `&pageToken=${data.nextPageToken}`;
       res = await fetch(nUrl);
       data = await res.json();
       if (data.models) allModels = [...allModels, ...data.models];
    }
    
    allModels.forEach(m => console.log(m.name));
  } catch (err) {
    console.error(err);
  }
}

listModels();
