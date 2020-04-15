const express = require('express')
const app = express()
const hbs = require('hbs')
const PORT = process.env.PORT || 8000

const mysession = require('express-session')
const {check,validationResult}= require('express-validator')

const {MongoClient} =  require('mongodb')
const uri = "mongodb+srv://abhinav:murderousmaths@eventscluster-2pgiy.gcp.mongodb.net/test?retryWrites=true&w=majority"
const client = new MongoClient(uri,{useNewUrlParser:true,useUnifiedTopology:true})

app.set('view engine','hbs')
//uses
//<------------------------------->
app.use(express.urlencoded({ extended:true })) 
app.use(express.static(__dirname+'/views'))
app.use(mysession({
    secret:'abhi',
    saveUninitialized:false,
    resave:false,
    cookie:{
        httpOnly:true,
        maxAge:1000*60*60 //1hour
    }
}))

//vars
var list = []

//gets
//<------------------------------->
app.get('/',(req,res)=>{
    console.log('Home page')
    console.log('ID:',req.sessionID)
    res.sendFile(__dirname+'/views/home.html')
})

app.get('/login',(req,res)=>{
    console.log('Login')
    console.log('ID:',req.sessionID)
    console.log('GETLOGIN',req.session)
    res.sendFile(__dirname+'/views/login.html')
})

app.get('/signup',(req,res)=>{
    console.log('Signup')
    console.log('ID:',req.sessionID)
    console.log('GETSIGNUP',req.session.errors)

    res.render(__dirname+'/partials/signup.hbs',{
        title:'Form validation',
        success:req.session.success,
        errors:req.session.errors? req.session.errors.errors : []
    })
    req.session.errors = null
})

app.get('/events',(req,res)=>{
    console.log('Events',list)
    console.log('ID:',req.sessionID)
    console.log('GETEVENTS',req.session.errors)
   
    if(req.session.user){
        console.log('WElCOME')
        
        checkDB('','events')
        .then((event)=>{
            res.render(__dirname+'/partials/events.hbs',{
                events : event,
                errors:req.session.errors? req.session.errors.errors : []
            })
            req.session.errors = null
        })
        .catch(()=>{
            console.log('event not recieved FALIURE')
            res.redirect('/events')
        }) 
    }
    else {
        res.send(`<h1>please LOGIN first !</h1>`)
    }
})

app.get('/display',(req,res)=>{
    console.log('Display')
    console.log('ID:',req.sessionID)

    if(req.session.user){
        console.log('WELCOME user: ',req.session.user)

        checkDB('','events')
        .then((event)=>{
            res.render(__dirname+'/partials/display.hbs',{
                liste : event
            })
        })
        .catch(()=>{
            console.log('events not recieved FALIURE')
            res.status(100).send(`<h1>Error! plz reload the page</h2>`)
        }) 
    }
    else{
        res.send(`<h1>PLEASE LOGIN TO VIEW YOUR EVENTS!</h1>`)
    }
})

app.get('/logout',(req,res)=>{
    console.log('LOGOUT')
    req.session.destroy()
    res.redirect('/')
})

//posts
//<------------------------------->
app.post('/login',(req,res)=>{
    console.log(req.body,'LOGIN')

    checkDB(req.body,'users')
    .then((user)=>{
        console.log('succesfull login',user[0].firstname)
        req.session.user = user[0].password
        res.redirect('/events')
    })
    .catch(()=>{
        console.log('LOGIN FALIURE')
        res.redirect('/login')
    })
})

app.post('/signup',[
    check('email','Enter valid email @').isEmail(),
    check('firstname','First Name cannot be empty').isLength({min:1,max:100}),
    check('password',`Your password should have :<br> 1.minimum length 4 chars <br> 2.alphabets and numbers <br> 3.no symbols <br> 4.max length 10chars`).isLength({min:4,max:10}).isAlphanumeric()
],(req,res)=>{
    console.log(req.body)

    var errors = validationResult(req)
    if(errors.errors.length>0){
        req.session.errors = errors
        res.redirect('/signup')
    }
    else
    {
        createDB(req.body,'users')
        res.redirect('/login')
    }
})

app.post('/events',[
    check('datetimes','Enter valid date').isAfter(),
    check('eventname','Event name cannot be empty').isLength({min:1,max:100}),
    check('contact',`enter valid 10 digit mobile no.`).isNumeric().isLength({min:10,max:10}).isAlphanumeric()
    ],(req,res)=>{
    console.log(req.body)
    
    var errors = validationResult(req)
    if(errors.errors.length>0){
        req.session.errors = errors
        req.session.success = false
        res.redirect('/events')
    }
    else{
        req.session.success = true 

        var myid = Math.random()*10000;
        myid = myid.toFixed(0)
        console.log('id: ',myid)
    
        list.push({ 
            eventname: req.body.eventname,
            datetimes: req.body.datetimes,
            description: req.body.description,
            email: req.body.email,
            contact: req.body.contact,
            location: req.body.location,
            states: req.body.states,
            id : myid
        })
        createDB(list[list.length-1],'events')

        res.redirect('/display')
    }
})

app.post('/display',(req,res)=>{
    console.log(req.body)
    var val = req.body.deletes
    
    // if(val){
    //     var i = list.findIndex((ele)=>{
    //         return ele.id==val
    //     })
    //     console.log(i)
    //     list.splice(i,1)
    
    //     console.log('DELETES')
    //     res.redirect('/display')
    // }
    removeDB(val,'events')
    res.redirect('/display')
})

//Database functions
//<-------------------------------------->
const setDB = dbname => 
    client.connect()
        .then(()=>client.db(dbname))
        .catch(err=>console.log('ERROR : given DB cannot be created',err))

var userdb = setDB('userDB')
console.log(userdb)

const createDB = (list,colls) =>{
    userdb.then(db => {
        const coll = db.collection(colls)

        coll.insertOne(list)
        console.log('DB is working !')
    }).catch(err=>console.log('ERROR',err))
}

const checkDB = (list,colls) =>{
    
    let truth = new Promise((Resolve,Reject)=>{
        userdb.then(db => {
        
            if(colls == 'users'){
            const users = db.collection(colls)
            const cursor = users.find({
                firstname : list.user,
                password : list.pass
            }).toArray()

            cursor.then((arr) => {
                console.log(arr)
                if(arr.length>0)
                {
                    console.log('FOUND!')
                    Resolve(arr)
                }
                else {
                    console.log('not found')
                    Reject()
                }
            })}

            if(colls == 'events'){
                const events = db.collection(colls)
                const cursor = events.find({}).toArray()
    
                cursor.then((arr) => {
                    console.log(arr)
                    if(arr.length>=0)
                    {
                        console.log('FOUND!')
                        Resolve(arr)
                    }
                    else {
                        console.log('not found')
                        Reject('DOC NOT FOUND $$$$')
                    }
                })
            }
        })
    })
    //ASYNC problem in "truth" here solve it!
    return truth
}

const removeDB = (list,colls) => {
    let truth = new Promise((resolve,reject)=>{
        userdb
        .then(db => {
            if(colls === 'events'){
                db.collection(colls).deleteOne({
                    id : list
                })
            }
        })
        .catch(err => console.log('ERROR [removeDB]',err))
    })
    return truth
}

app.listen(PORT,()=>{
    console.log('listening on port 8000')
})