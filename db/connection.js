const mongoose=require('mongoose')
mongoose.set('strictQuery',false)
// strictQuery it is used when any extra perimter is send then it will not through an error it will ignore it when
// we use false or if something which is not present in the db and accessed then it will not through an error but it 
// will ignore it
MONGO_URL='mongodb+srv://chatt_app:1234@cluster0.gmttgau.mongodb.net/'
const connectionToDB=async()=>{
    try{
        // it will proide a instance
        const {connection}=await mongoose.connect(
          MONGO_URL
        )
        if(connection){
            console.log(`Connected to mongo DB: ${connection.host}`);
        }
        
    }
    catch(e){
        console.log(e);
        // forcefully exit
        process.exit(1);
    }
}

module.exports =connectionToDB