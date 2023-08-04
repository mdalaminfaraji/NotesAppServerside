import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { MongoClient, ServerApiVersion, ObjectId } from 'mongodb';

require('dotenv').config();

const app = express();

const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());
interface DecodedUser {
    email: string;
  }
  declare global {
    namespace Express {
      interface Request {
        decoded?: DecodedUser;
      }
    }
  }
   

// Verify JWT


const verifyJWT = (req: Request, res: Response, next: NextFunction) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
      return res.status(401).send({ error: true, message: 'unauthorized access' });
    }
    // bearer token
    const token = authorization.split(' ')[1];
  
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET as string, (err, decoded) => {
      if (err) {
        return res.status(401).send({ error: true, message: 'unauthorized access' });
      }
      req.decoded = decoded as DecodedUser;
      next();
    });
  };

// MongoDB

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wu2rnap.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const usersCollection = client.db('NotesApp').collection('users');
    const AddNoteCollection = client.db('NotesApp').collection('allNote');

    app.post('/jwt', (req: Request, res: Response) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET as string, { expiresIn: '1h' });

      res.send({ token });
    });

    // User Related Data
    app.post('/users', async (req: Request, res: Response) => {
      const user: any = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: 'user already exists' });
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get('/getNote/:email',verifyJWT,  async (req: Request, res: Response) => {
      const { email } = req.params;
      const result = await AddNoteCollection.find({ email }).toArray();
      res.send(result);
    });

    app.post('/addNote', async (req: Request, res: Response) => {
      const NoteData: any = req.body;
      const result = await AddNoteCollection.insertOne(NoteData);
      res.send(result);
    });

    app.put('/update/:id', async (req: Request, res: Response) => {
      const id: string = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const option = { upsert: true };
      const updateNote: any = req.body;
      const Note = {
        $set: {
          title: updateNote.title,
          content: updateNote.content,
          category: updateNote.category,
          photoLink: updateNote.photoLink,
        },
      };
      const result = await AddNoteCollection.updateOne(filter, Note, option);
      res.send(result);
    });

    app.delete('/addNoteDelete/:id', async (req: Request, res: Response) => {
      const id: string = req.params.id;
      console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await AddNoteCollection.deleteOne(query);
      res.send(result);
    });

    app.get('/search', verifyJWT, async (req: Request, res: Response) => {
      const { query } = req.query;

      const regexQuery = new RegExp(query as string, 'i');
      const result = await AddNoteCollection.find({
        $or: [{ title: regexQuery }, { category: regexQuery }],
      }).toArray();
      res.send(result);
    });

    app.get('/api/notes/:email',verifyJWT, async (req: Request, res: Response) => {
        const userEmail = req.params.email;
      
        try {
          const notes = await AddNoteCollection.find({ email: userEmail }).toArray();
          res.json(notes);
        } catch (error) {
          console.error('Error fetching user notes:', error);
          res.status(500).json({ error: 'Internal server error' });
        }
      });
      // Route to handle search
app.get('/api/search',verifyJWT, async (req: Request, res: Response) => {
    const userEmail = req.query.userEmail as string;
    const searchTerm = req.query.term as string;
  
    try {
      const searchRegex = new RegExp(searchTerm, 'i'); // 'i' option makes the search case-insensitive
      const searchResults = await AddNoteCollection
        .find({
          email: userEmail,
          $or: [
            { title: { $regex: searchRegex } },
            { category: { $regex: searchRegex } },
            { content: { $regex: searchRegex } },
          ],
        })
        .toArray();
  
      res.json(searchResults);
    } catch (error) {
      console.error('Error searching notes:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 });
    console.log('Pinged your deployment. You successfully connected to MongoDB!');
  } finally {
    // Ensures that the client will close when you finish/error
    //   await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req: Request, res: Response) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
