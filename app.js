const express =require('express')
const app=express()
const port=process.env.PORT||8000
const bcryptjs=require('bcryptjs')
const jwt=require('jsonwebtoken')
// require('./db/connection.js')
const connectionToDB=require('./db/connection')
const Users=require('./models/User')
const Conversation=require('./models/Conversation')
app.use(express.json())
app.use(express.urlencoded({extended:false}))

app.get('/',(req,res)=>{
    res.send('welcome')
})
app.post('/api/register',async (req,res,next)=>{
    try{
        const {fullName,email,password}=req.body
        if(!fullName || !email || !password){
            res.status(400).send('Please fill all entries')
        }
        else{
            const isExist=await Users.findOne({email})
            if(isExist){
                res.status(400).send('User already Exist')
            }
            else{
                const newUser=new Users({
                    fullName,
                    email
                })
                bcryptjs.hash(password,10,(err,hashedPasword)=>{
                    newUser.set('password',hashedPasword)
                    newUser.save()
                    next();
                })
                return res.status(200).send('User is registered Successfully')
            }
        }
    }
    catch(e){
        console.log(e.message);
    }
})

app.post('/api/login', async (req,res,next)=>{
    try{
        const {email,password}=req.body
        if(!email || !password){
            res.status(400).send('Please fill all entries')
        }
        else{
            const user=await Users.findOne({email})
            if(!user){
                res.status(400).send('Please enter valid email Id')
            }
            else{
               const validateUser=await bcryptjs.compare(password,user.password)
               if(!validateUser){
                    res.status(400).send('Enter Valid password')
               }
               else{
                    const payload={
                        userId:user._id,
                        email:user.email
                    }
                    const JWT_SECRET_KEY=process.env.JWT_SECRET_KEY||'534'

                    jwt.sign(payload,JWT_SECRET_KEY,{expiresIn:84600},async(err,token)=>{
                        await Users.updateOne({_id:user._id},{
                            $set:{token}
                        })
                        user.save()
                        next()
                    })
                    res.status(200).json({user:{email:user.email,fullName:user.fullName},token:user.token})
               }

            }
        }
    }
    catch(e){
        console.log(e.message);
    }
})

app.post('/api/conversation',async(req,res,next)=>{
    try{
        const {senderId,receiverId}=req.body
        const newConversation=new Conversation({members:[senderId,receiverId]})
        await newConversation.save()
        res.status(200).send('Conversation Created successfully')
    }
    catch(e){
        console.log(e.message);
    }
})

app.get('/api/conversaion/:userId',async(req,res,next)=>{
    try{
        const userId=req.params.userId
        const conversation=await Conversation.find({members:{$in:[userId]}})
        const conversationUserData=Promise.all(conversation.map(async(conversation)=>{
            const receiverId=conversation.members.find((member)=>member!==userId)
            const user= await Users.findById(receiverId)
            return {user:{email:user.email,fullName:user.fullName},conversationId:conversation._id}
        }))
        res.status(200).json(await conversationUserData)
    }
    catch(e){
        console.log(e.message);
    }
})
app.listen(port,async()=>{
    await connectionToDB()
    console.log('listening on port ' +port);
})