const express =require('express')
const app=express()
const port=process.env.PORT||8000
// require('./db/connection.js')
const connectionToDB=require('./db/connection')
const Users=require('./models/User')
app.use(express.json())
app.use(express.urlencoded({extended:false}))

app.get('/',(req,res)=>{
    res.send('welcome')
})
app.listen(port,async()=>{
    await connectionToDB()
    console.log('listening on port ' +port);
})