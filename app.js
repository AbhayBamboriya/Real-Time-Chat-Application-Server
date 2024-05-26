const express =require('express')
const app=express()
const port=process.env.PORT||8000
const bcryptjs=require('bcryptjs')
const jwt=require('jsonwebtoken')
const morgan=require('morgan')
// require('./db/connection.js')
const connectionToDB=require('./db/connection')
const Users=require('./models/User')
const Conversation=require('./models/Conversation')
const Messages=require('./models/Messages')
const cors=require('cors')
const { Socket } = require('socket.io')
const io=require('socket.io')(8080,{
    cors:{
        origin:'http://localhost:3000'
    }
})
app.use(express.json())
app.use(express.urlencoded({extended:false}))
app.use(cors())
app.use(morgan('dev'))
app.get('/',(req,res)=>{
    res.send('welcome')
})
// socket io
let users=[]
io.on('connection',socket=>{
    // receivingg on backend use on 
    console.log('user Conneced',socket.id);
    socket.on('addUser',userId=>{
        const isUserExist=users.find(user=>user.userId===userId)
        if(!isUserExist){
            const user={userId,socketId:socket.id}
            users.push(user)
            io.emit('getUser',users)
        }
        socket.userId=userId
    });
    socket.on('sendMessage',async({senderId,receiverId,message,conversationId})=>{
        // console.log('Userass',users);
      
        // console.log('Usersss',user);
        const receiver=users.find(user=>user.userId===receiverId)
        const sender=users.find(user=>user.userId===senderId)
        const user=await Users.findById(senderId)
        // console.log('sender',sender,receiver);
        if(receiver){
            io.to(receiver.socketId).to(sender.socketId).emit('getMessage',{
                senderId,
                message,
                conversationId,
                receiverId,
                user:{id:user._id,fullName:user.fullName,email:user.email}
            })
        }
        // else{
        //     io.to(sender.socketId).emit('getMessage',{
        //         senderId,
        //         message,
        //         conversationId,
        //         receiverId,
        //         user:{id:user._id,fullName:user.fullName,email:user.email}
        //     })
        // }
    })
    // sending data from backend to frontend
    // io.emit('getUsers',socket.userId)
    socket.on('disconnect',()=>{
        users=users.filter(user=>user.socketId!==socket.id)
        // io.emit is used to send deatils from backend
        io.emit('getUser',users)
    })

})
// app.use(morgan('dev'))
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
                // res.status(200).json({
                //     message:'User is registered Successfully',
                    
                // })
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
                        return res.status(200).json({user:{id:user._id,email:user.email,fullName:user.fullName},token:token})
                        
                    })
                   
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

app.get('/api/conversation/:userId',async(req,res,next)=>{
    try{
        const userId=req.params.userId
        const conversation=await Conversation.find({members:{$in:[userId]}})
        // console.log('conversation',conversation);
        const conversationUserData=Promise.all(conversation.map(async(conversation)=>{
            const receiverId=conversation.members.find((member)=>member!==userId)
            const user= await Users.findById(receiverId)
            return {user:{receiverId:user._id,email:user.email,fullName:user.fullName},conversationId:conversation._id}
        }))
        res.status(200).json(await conversationUserData)
    }
    catch(e){
        console.log(e.message);
    }
})
app.post('/api/message',async(req,res,next)=>{
    try{
        const {conversationId,senderId,message,receiverId=''}=req.body
        if(!senderId || !message )  return res.status(200).send('Please fill all entries')
        if(conversationId==='new' && receiverId) {
            const newConversation=new Conversation({members:[senderId,receiverId]})
            await newConversation.save()
            const newMessage=new Messages({conversationId:newConversation._id,senderId,message})
            await newMessage.save()
            return res.status(200).send('Message sent successfully')

        }
        else if(!conversationId && !receiverId){
            return res.status(400).send('Please fill all entries')
        }
        const newMessage=new Messages({conversationId,senderId,message})
        await newMessage.save();
        res.status(200).send('Messages sent successfully');

    }
    catch(e){
        console.log(e);
    }
})

app.get('/api/message/:conversationId',async(req,res)=>{
    try{
        const checkMessage=async(conversationId)=>{
            const message=await Messages.find({conversationId})
            const messageUserData=Promise.all(message.map(async(message)=>{
                console.log('sender id',message.senderId);
                const user=await Users.findById(message.senderId)
                return {user:{id:user._id,email:user.email,fullName:user.fullName},message:message.message}
                // return user
                // console.log('user',user);
                // console.log('message',message);
                //  {(!user) return message:message.message,}
            }))
            res.status(200).json(await messageUserData)

        }
        const conversationId=req.params.conversationId

        if(conversationId==='new') {
            const checkConversation=await  Conversation.find({members:{$all:[req.query.senderId,req.query.receiverId]}})
            if(checkConversation.length>0) checkMessage(checkConversation[0]._id)
            else return res.status(200).json([])
        }else{
            checkMessage(conversationId)
        }
        
    }

    catch(e){
        console.log(e);
    }
})


app.get('/api/users/:userId',async(req,res,next)=>{
    try{
        const userId=req.params.userId
        // $ne=not equal to
        const users=await Users.find({_id:{$ne:userId}})
        const userData=Promise.all(users.map(async(user)=>{
            return {user: {email:user.email,fullName:user.fullName,receiverId:user._id}}
        }))
        res.status(200).json(await userData)
    }
    catch(e){
        console.log(e);
    }
})


app.listen(port,async()=>{
    await connectionToDB()
    console.log('listening on port ' +port);
})