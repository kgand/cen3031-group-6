#rag_system.py
import os
import time
import requests
import numpy as np
from dotenv import load_dotenv
from openai import OpenAI
from typing import List, Tuple, Dict, Any, Optional
import logging
import json
import tiktoken
import backoff
import traceback
from supabase_client import SupabaseClient

# Import our custom logging configuration
from logging_config import setup_logging

# Configure logging
logger = setup_logging("rag_system")
logger.info("Initializing RAG system")

# Load environment variables
load_dotenv()

# API Keys
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# Log API key status
logger.info(f"OpenAI API Key loaded: {'Yes' if OPENAI_API_KEY else 'No'}")
logger.info(f"OpenRouter API Key loaded: {'Yes' if OPENROUTER_API_KEY else 'No'}")

# Initialize OpenAI client for embeddings
openai_client = None
if OPENAI_API_KEY:
    try:
        openai_client = OpenAI(api_key=OPENAI_API_KEY)
        logger.info("OpenAI client initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize OpenAI client: {e}")

# Initialize Sentence Transformers for local embeddings
sentence_transformer = None
try:
    from sentence_transformers import SentenceTransformer
    sentence_transformer = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
    logger.info("Sentence Transformers model loaded successfully")
except ImportError:
    logger.warning("Sentence Transformers not installed. Run 'pip install sentence-transformers'")
except Exception as e:
    logger.error(f"Error loading Sentence Transformers model: {e}")

# Define constants
EMBEDDING_DIMENSION = 384  # Matches Sentence Transformers model dimension
CHUNK_SIZE = 100
CHUNK_OVERLAP = 10
MAX_RETRIES = 3
USE_LOCAL_EMBEDDINGS = True  # Set to False to use OpenAI embeddings instead

class RAGSystem:
    def __init__(self):
        """Initialize the RAG system with Supabase integration"""
        try:
            self.supabase = SupabaseClient()
            logger.info("Supabase client initialized")
            
            # Initialize tokenizer
            self.encoder = tiktoken.get_encoding("cl100k_base")
            logger.info("Tiktoken encoder initialized")
        except Exception as e:
            logger.error(f"Error initializing RAG system: {e}")
            logger.debug(traceback.format_exc())
            raise

    def chunk_text(self, text: str) -> List[str]:
        """Split text into overlapping chunks based on token count."""
        if not text:
            logger.warning("Empty text provided for chunking")
            return []
            
        try:
            tokens = self.encoder.encode(text)
            chunks = []
            
            i = 0
            while i < len(tokens):
                # Get chunk_size tokens
                chunk_end = min(i + CHUNK_SIZE, len(tokens))
                chunk = self.encoder.decode(tokens[i:chunk_end])
                chunks.append(chunk)
                
                # Move to next chunk with overlap
                i += CHUNK_SIZE - CHUNK_OVERLAP
                
                # Avoid getting stuck
                if i >= len(tokens) or i < 0:
                    break
            
            logger.info(f"Text split into {len(chunks)} chunks")
            return chunks
        
        except Exception as e:
            logger.error(f"Error chunking text: {e}")
            # Simple fallback chunking by words
            words = text.split()
            chunks = []
            for i in range(0, len(words), CHUNK_SIZE):
                chunk = " ".join(words[i:i + CHUNK_SIZE])
                chunks.append(chunk)
            logger.info(f"Used fallback chunking method: {len(chunks)} chunks")
            return chunks

    def generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings using the best available method."""
        if not texts:
            logger.warning("Empty texts provided for embedding")
            return []
            
        # Use local embeddings if available and enabled
        if USE_LOCAL_EMBEDDINGS and sentence_transformer:
            try:
                logger.info(f"Generating local embeddings for {len(texts)} chunks")
                start_time = time.time()
                
                # Process in batches for better memory management
                batch_size = 32
                all_embeddings = []
                
                for i in range(0, len(texts), batch_size):
                    batch_texts = texts[i:i + batch_size]
                    batch_embeddings = sentence_transformer.encode(batch_texts)
                    all_embeddings.extend(batch_embeddings.tolist())
                
                logger.info(f"Generated {len(all_embeddings)} local embeddings in {time.time() - start_time:.2f}s")
                return all_embeddings
            except Exception as e:
                logger.error(f"Error generating local embeddings: {e}")
                # Continue to OpenAI if local embedding fails
        
        # Use OpenAI embeddings if available
        if openai_client:
            try:
                batch_size = 5  # Smaller batch size to avoid rate limits
                all_embeddings = []
                
                for i in range(0, len(texts), batch_size):
                    batch_texts = texts[i:i + batch_size]
                    logger.info(f"Generating OpenAI embeddings for batch {i//batch_size + 1}/{(len(texts) + batch_size - 1)//batch_size}")
                    
                    response = openai_client.embeddings.create(
                        model="text-embedding-ada-002",
                        input=batch_texts
                    )
                    
                    batch_embeddings = [item.embedding for item in response.data]
                    all_embeddings.extend(batch_embeddings)
                    
                    # Add delay between batches
                    if i + batch_size < len(texts):
                        time.sleep(2.0)
                
                logger.info(f"Successfully generated {len(all_embeddings)} OpenAI embeddings")
                return all_embeddings
            except Exception as e:
                logger.error(f"Error generating OpenAI embeddings: {e}")
                # Fall back to random embeddings as last resort
        
        # Last resort: random embeddings
        logger.warning(f"Using random embeddings for {len(texts)} chunks (both local and OpenAI methods failed)")
        return [np.random.rand(EMBEDDING_DIMENSION).tolist() for _ in texts]

    def cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Calculate cosine similarity between two vectors."""
        dot_product = np.dot(vec1, vec2)
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        return dot_product / (norm1 * norm2) if norm1 > 0 and norm2 > 0 else 0

    def retrieve_chunks(self, query_embedding: List[float], 
                       indexed_chunks: List[Tuple[str, List[float]]], 
                       k: int = 5) -> List[str]:
        """Retrieve most relevant chunks based on cosine similarity."""
        if not indexed_chunks:
            logger.warning("No chunks to retrieve from")
            return []
        
        try:
            # Calculate similarities
            similarities = []
            for chunk, embedding in indexed_chunks:
                similarity = self.cosine_similarity(query_embedding, embedding)
                similarities.append((chunk, similarity))
            
            # Sort by similarity and get top k
            similarities.sort(key=lambda x: x[1], reverse=True)
            top_chunks = [chunk for chunk, sim in similarities[:k]]
            
            # Log similarity scores for diagnostics
            top_similarities = [sim for _, sim in similarities[:k]]
            logger.info(f"Retrieved top {len(top_chunks)} chunks with similarities: {top_similarities}")
            
            return top_chunks
        except Exception as e:
            logger.error(f"Error retrieving chunks: {e}")
            return []

    @backoff.on_exception(backoff.expo, Exception, max_tries=MAX_RETRIES)
    def generate_response(self, query: str, context: str, 
                        model: str = "meta-llama/llama-3-8b-instruct") -> str:
        """Generate a response using OpenRouter API with retry logic."""
        if not OPENROUTER_API_KEY:
            logger.error("OpenRouter API key not found")
            return "Error: OpenRouter API key not found."
        
        try:
            prompt = f"""Generate a response to the following query using the provided context.
            
            Context:
            {context}
            
            Query:
            {query}
            
            Response:"""
            
            logger.debug(f"Generating response with model: {model}")
            logger.debug(f"Prompt length: {len(prompt)} chars")
            
            response = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "HTTP-Referer": "localhost",
                    "X-Title": "RAG System",
                    "Content-Type": "application/json"
                },
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 500
                },
                timeout=30
            )
            
            if response.status_code == 200:
                response_json = response.json()
                logger.debug("Successfully generated response from OpenRouter")
                return response_json['choices'][0]['message']['content']
            else:
                logger.error(f"Error from OpenRouter API: {response.status_code} - {response.text}")
                return f"Error: HTTP {response.status_code} - {response.text}"
                
        except requests.exceptions.Timeout:
            logger.error("Request to OpenRouter timed out")
            return "Error: Request timed out."
        except Exception as e:
            logger.error(f"Error generating response: {e}")
            return f"Error: {str(e)}"

    def process_document(self, document: str, query: str, chunks_to_retrieve: int = 5) -> Dict[str, Any]:
        """Process a document and query through the RAG pipeline."""
        logger.info(f"Processing document with RAG pipeline for query: '{query}'")
        logger.debug(f"Document length: {len(document)} chars, chunks to retrieve: {chunks_to_retrieve}")
        
        start_time = time.time()
        result = {
            "success": False,
            "query": query,
            "retrieved_chunks": [],
            "response": "",
            "processing_time": 0,
            "error": None,
            "timings": {
                "chunking": 0,
                "embedding": 0,
                "retrieval": 0,
                "response": 0,
                "total": 0
            }
        }
        
        try:
            # Step 1: Chunking
            chunking_start = time.time()
            logger.debug("Step 1: Chunking document...")
            chunks = self.chunk_text(document)
            result["timings"]["chunking"] = time.time() - chunking_start
            logger.debug(f"Created {len(chunks)} chunks in {result['timings']['chunking']:.2f}s")
            
            if not chunks:
                logger.warning("No chunks were created from the document")
                result["error"] = "Failed to create chunks from document"
                return result
                
            # Step 2: Embedding chunks
            embedding_start = time.time()
            logger.debug("Step 2: Generating embeddings for chunks...")
            chunk_embeddings = self.generate_embeddings(chunks)
            
            if not chunk_embeddings or len(chunk_embeddings) != len(chunks):
                logger.error(f"Embedding generation failed or mismatch: got {len(chunk_embeddings) if chunk_embeddings else 0} embeddings for {len(chunks)} chunks")
                result["error"] = "Failed to generate embeddings for chunks"
                return result
                
            # Step 3: Embedding query
            logger.debug("Step 3: Generating embedding for query...")
            query_embedding = self.generate_embeddings([query])
            
            if not query_embedding:
                logger.error("Failed to generate embedding for query")
                result["error"] = "Failed to generate embedding for query"
                return result
                
            query_embedding = query_embedding[0]
            result["timings"]["embedding"] = time.time() - embedding_start
            logger.debug(f"Generated embeddings in {result['timings']['embedding']:.2f}s")
            
            # Step 4: Retrieval
            retrieval_start = time.time()
            logger.debug("Step 4: Retrieving chunks...")
            relevant_chunks = self.retrieve_chunks(
                query_embedding, 
                list(zip(chunks, chunk_embeddings)), 
                k=chunks_to_retrieve
            )
            result["timings"]["retrieval"] = time.time() - retrieval_start
            logger.debug(f"Retrieved {len(relevant_chunks)} chunks in {result['timings']['retrieval']:.2f}s")
            
            if not relevant_chunks:
                logger.warning("No relevant chunks were retrieved")
                result["error"] = "No relevant chunks could be retrieved from the document"
                return result
                
            # Step 5: Response generation
            response_start = time.time()
            logger.debug("Step 5: Generating response...")
            context = "\n\n".join(relevant_chunks)
            logger.debug(f"Context for LLM (length: {len(context)} chars)")
            response = self.generate_response(query, context)
            result["timings"]["response"] = time.time() - response_start
            logger.debug(f"Response generated in {result['timings']['response']:.2f}s")
            
            if not response or response.startswith("Error:"):
                logger.error(f"Response generation failed: {response}")
                result["error"] = response or "Failed to generate response"
                return result
                
            # Populate result
            result["success"] = True
            result["retrieved_chunks"] = relevant_chunks
            result["response"] = response
            result["processing_time"] = time.time() - start_time
            result["timings"]["total"] = result["processing_time"]
            logger.info(f"RAG processing completed successfully in {result['processing_time']:.2f}s")
            
            return result
                
        except Exception as e:
            error_trace = traceback.format_exc()
            logger.error(f"Error in RAG pipeline: {str(e)}")
            logger.debug(f"Error traceback: {error_trace}")
            result["error"] = str(e)
            result["processing_time"] = time.time() - start_time
            result["timings"]["total"] = result["processing_time"]
            return result


# If run directly, perform a demo
if __name__ == "__main__":
    # Print embedding strategy
    print("\n" + "="*50)
    print(f" RAG System (Using {'local' if USE_LOCAL_EMBEDDINGS else 'OpenAI'} embeddings) ")
    print("="*50 + "\n")
    
    # Create sample document and query for testing
    document = """
    How are you?
Okay?
Okay, I can explain that out.
I was the real.
And so then, like, I'm just gonna let them know.
I, literally
2, 16, divided by 3 0.
I'm like, I was just so incredibly scared.
There was a lot of
really okay, the amount of iphone notification
interesting. Yeah.
going on.
They said that if you would like it, I think they just have you like, say, like, Hey.
providing, you know.
Unfortunately, I don't think.
Thank you. Like, when the grade comes in, it's harsh, is like.
could I maybe like, add, like, Yeah, sure, okay, yeah, yeah. I mean, I'm doing the grading. So
you remember now?
No, I don't. Okay, yeah, I'll have a look.
I like, I promise you. I literally I was studying. He's like, I know.
But like this is literally, it's just like.
and like, you can see, I was like highlighting. Yeah. Yeah. And while studying with my friends, I started.
And then, of course, on the task.
Yeah. And I already calculated the worst case scenario.
Well, I can tell you that
I am grading that one now, and I take into account if
if you got the block size where the offset style wrong, is your answer correct
in context of your incorrect answer.
Well, if you got the block size wrong, you'd lose those points. But then you could get other questions right?
Based on what? You answered, okay.
yeah, like, those are really
okay.
Yeah, sure, in context of coaching, no worries in terms of
that was just.
And every question I've gotten so far the main line.
But the main memory has to the 32, 1 point.
Well, we'll see.
Okay, once we're going to be alright.
Okay, you, too.
Okay.
hey? Everyone welcome. Welcome.
Okay?
So 1st thing we're going to do today is talk about the Cash Analysis project.
Yes.
So let's have a look at the Cash Simulation Project, which is due.
says it's due the 18.th But you really will have until Sunday to do it.
So what you're gonna do.
I'll go through that slide deck that's linked there.
But what you're gonna do is download.
You can download my code to run the simulation, and you can write your own if you like.
My code, there is just meant to run from the command line. There's no user interface.
It also doesn't do a lot of input validation. So
what it's gonna ask you for is a file name that'll be a trace file, and I'll show you the trace files you have to choose from. So the trace files are
lists of memory accesses from a particular run of a executable.
Okay, it's going to ask for a trace file. And it says, for parameters of a cache.
So the parameters are going to be, how big is the cache? What's the block size? What's the associativity so direct? Map set associative or
fully associative.
And then replacement
replacement scheme. So there's 2 replacement schemes, 1st in 1st out, or least recently used. So it'll ask you for those parameters. It's up to you to give parameters that make sense. Okay? So you might get a seg fault if you make a teeny, tiny cache
with
a giant or a block size that's the same size as the cache, and then you say it's 2 way set associated right? So you don't even have 2 blocks in this cache, it'll give you a cycle. So you have to like.
I'm counting on you to make sure this program is counting on you to put in values that make sense
that you're not going to have a block that's bigger than the cache. You're not, you know, right? So you have to have
numbers that make sense, and then you can read.
Write it, however you like, or you can write your own
so what you're gonna do again is you are going to
come up with a set of parameters that you're going to use to test
the you know, the efficiency of cash. You come up with
the cache sizes, block size and associativities you're going to test
and you're also gonna describe why you chose those right?
so, and then you're going to write a report?
that is going to answer the following questions. So how does the performance of the past change with associativity.
So pro tip, direct map does the worst and fully associated is the best, and if you get results that aren't that, you should ask yourself
where you went wrong. Right? So how does the performance of a cache change with cache size?
So this one should be kind of intuitive. So a bigger cache is gonna be better or worse
is going to be better. So as the cash size goes up, your hit rate will go up.
How does the performance change with replacement policy?
So there's least recently used. And 1st in 1st out. So again, which one you think so.
which one do you think performs better?
Yeah, least recently used performs better. So least recently used, says
What's the one I haven't accessed in the longest amount of time.
And 1st and 1st out is what's the one that I
that was brought in the longest time ago?
Right? So the 1st and for a Stat doesn't account for actually you going to that accessing that thing over and over. So at least recently, you should perform better.
How does the performance change with the line size. This one's kind of an interesting one, because there is a sweet spot. So if the block is too big
compared to the cash, you don't get as good a performance. If the block is too small, you don't get as good a performance. There's actually a sweet spot in the middle
that you can see. So it isn't a it isn't a strictly increasing or decreasing performance.
And then new for this semester. What's the performance of the cache design of 2 real devices. So again, you can go to the
discussion thread. Look at real devices out there. Pick one of you know the l. 1 l. 2 l. 3 cache from a real device. Put in those
parameters and stick it on the graph. Get the hit rate, stick it on the graph and see, you know, how does it compare?
Oh, to the other hash
design? Right? So just stick it on your graph like, have a couple of points for your real devices.
Hi,
If you're if you want to. So again, you're gonna write it paper, and you're going to include
like. There's a very good list of what needs to be in there.
And then here's your rubric. So you can also look at the rubric and see, you know what matters what you need to do?
actually, you need to include a screen capture video. It can be one run. It can have no sound. It doesn't need to be
gigantic.
Because we're not really interested in downloading your gigantic video. But it can be short. But like one run. But it needs to show one run a screen capture of one run of the simulation and your name. Just so we know you actually
rant you know, just like, get someone's results.
But it's slightly different, anyways. Anyway. So you're gonna have a screen capture video. So the description, the introduction, you're gonna write an introduction.
It can be short. But why?
Why are we doing this analysis so obviously? You're doing it? Because I told you to. But why would I tell you to do such an analysis? What is the purpose of such
and then the description of tests? Again, you're going to pick
you're gonna pick the cash
sizes and block sizes and associativities that you're going to test.
But there should be some reasoning that you had for choosing these values. It can be as simple as
You know. I looked at real caches, and I wanted to get a range of values of, you know, in.
you know.
I wanted to get a range of values to see the performance, and I wanted to include some of the real fashion designs that I
right?
anyway.
So you need to write up. Why, you pick that again. It doesn't need to be elaborate. But you need to say why you pick those values.
Your plots. I'll show you what a plot should look like.
You get some points for it, making theoretical sense. So if you turn something in that doesn't make sense. You're going to lose points. And then you're going to write conclusions. So you're going to write conclusions that answer all of
these questions. Okay.
alright. So let's look at.
Okay.
One thing I want to show also. So if you go to files cash analysis, there's the
I don't think these 2 are different. The trace files
there's swim, dot, trace, and Gcc dot trace. You can use either one for your results.
Hi.
the smaller ones are just there for you to test out and make sure your results make sense. But you should use one of the 2 big ones for your testing.
Okay?
Okay?
So you are going to
run the cache simulator that reads a memory access trace from a file and determine whether each memory access is a hit or miss. So I gave you the program to do that, and it will output the hit rate.
So you're going to analyze the hit the performance in terms of hit rate for different cache designs. And you're going to write a paper that answers the following questions.
So yes, a badly, grammatically. Wrong sentence, how does hit rate? Change with associativity?
Right? So again, pro tip, direct map is the worst. Fully associate is the best.
How does the hit rate change with cash size again? It's it
gonna look kind of like a square root of n kind of thing.
and maybe logs. But the
the hit rate should get better with bigger caches. Right? That that's kind of into
not kind of intuitive. It is intuitive.
And then how does the hit rate change with the replacement policy? So you should show the same designs with Lru and Fifo and show that Lru is better?
And then how does the hit rate change with block size? So you're going to do a plot of different block sizes. So keep all everything. So when you're looking at these things. Keep everything else constant, and change the block size and see, you know, how does it change? Keep everything else constant, and change the cache size and
see how it changes. So this is what the trace file looks like.
The 1st column is whether it's a load or store.
We don't care for this, we treat it the same. The 3rd column is.
how many bytes are requested. Again. We don't.
Here we're we're just pretending we're getting 1 Byte, not not caring about how many bytes. And then this is the memory address. And then.
if I were making you write the code which in the past I did. You would care about this, so you would take this address and split it into its offset
line, or set number and tag.
Hi, but because I gave you the code how we do
right? So each run through a trace file. You'll put in the cache design.
So you're going to input? How many bytes are in the cache? How many bytes are in a block or line? And what's the associativity? And whether it's least recently used or fifo.
And so this is what a plot should look like.
So there's a couple things.
It needs to be an XY pot.
Okay, right? I know.
Don't give me a don't. Well.
I mean, I guess if your cash size is evenly distributed, which in this one it's not
so. Don't give me like a line plot. I want to see it has to be XY plot, and then this has to make. Here we are
right? Right? So it's gonna be hit rate on the Y axis and your cache size or block size on the X
axis. That'd be an XY plot.
You can see here
you should put on here, and this should have been on here. So here the block size is being held constant. You should write on the plot. What is the block size that you use, or you should at least write it in your report. You need to know what block size did you? So you're going to pick a block size again? You're going to pick all these parameters. Yeah.
no.
I mean, if you want to. You can but do this in addition, I want to be able to
see it. I want to be a
I need to be able to understand. If you want to do that, you can. But also give me those slices. Okay, how's that?
Right? So yeah, go ahead. Just give me the the easier ones, too.
Any who? That might be fun. Actually, I shouldn't say that. But
but I want the slides, too.
yeah, that that actually might be funny, though.
as long as I can understand.
anyhow, what was I? Where was I going? Okay, so you're going to come up with the parameters right? And you're going to have a reason for those parameters. Some reason it can be. It doesn't need to be elaborate, but.
like I picked 64 because
seem like a good idea. I don't know.
So you're going to pick
hash sizes. So this student did 5 cache sizes.
You know I'll get lots of questions. How many cash loads should I do? I mean, it doesn't
hurt
anything, or take very long to do more right. I did have one student who, like wrote it where it would change the cache size by 10 and automatically do it. So he had, like a beautiful, very
continuous plot. It looked like a beautiful thing, right? Looked like an equation. It was beautiful. Maybe change the cache size by. I don't know what
your shoes I don't remember, but anyway.
it's 5. 5 is good. More is better.
You can so try not to give me 10 shades of blue right on these plots.
Try to make it so. They're not all overlapping.
So I know I've taken visualization classes, and I know people frown upon having this
axis not be 0 right? I know it should be 0 to one but
if nothing else, give me a blow up of the part that's overlapping. I don't want to see a bunch of overlapping
right? I want to be able to see the line.
Grass onions.
You can also. So what? I added
again. So then you have to. Once you get
done, you need to say like, according to this plot, what's the effect of associativity. Well, I can see from here that the more items in a set the better the hit rate, right? Because it goes direct. Mapped
2, 4, 8 fully associative. So
the more associative it is the better the hit rate. Effective cache size. You can see it bigger cache size is higher hit rate.
and there's some diminishing returns happening in there
and then. Lru is better than python.
You're also this semester, I added, to do a real.
so you can look at the discussion and pick some real cash design. So you would put that on here somewhere. So maybe you'd have a
but and this would be my iphone. 15 l. 1 caches.
Okay, it's a bit, too. 2 of those make sense.
So you're going to do a plot for
another one that looks like it for hit rate versus blast.
Okay, yeah.
no, no. Just say, take the design.
run it through that trace file
and see what the hit rate is right.
And so you should get the cash size and
say that again.
oh, l. 1 l. 2 or no, I don't have a.
And then this student did 2, 4, and 8, you should do at least 2 set associative
person to 3.
Make sense.
Okay, again, this, I think it's great exercise
what I want you to get out of it. It shouldn't be too hard.
But we'll give you appreciation for why we care about cash.
At least I hope so.
Okay, so now we're going to talk a little bit about cash coherence.
So we we probably we're not going to get to multi-core processors or parallel processing this year. I mean this semester it took a week out of the semester. If you notice.
we now have 14 week semesters instead of 15. So
we're running out of time. We ran out of time. We're not going to get to parallel processing.
But
there, we've talked a little bit about multi-core processors. So the idea here is that there's multi cores would be. There's separate data paths, cpus, and l, 1 caches, you know. So there's 4 different
cpus or a data pads on a processor.
And so mono processors are mostly multi-core, with several layers of cached memory. And again, you can look at those discussion threads. So the modern processors you did see on there. It was pretty common that they each had their own l. 1 cache. Each core had their own l. 1 cache and a shared L. 2 and l. 3, 11.
So each of these processors have their own l. 1 cache, so it maintains its own private cache memory at the highest level of the memory hierarchy and shares a single cache with lower levels.
So we definitely won't talk about Gpus here, but it's kind of interesting. Gpus are like all these little reds, like thousands of them running, and they each have their own little memory.
Gpu Chips.
And if you're interested in the topic of parallel processing
and such, you can take the computer architecture class
which is offered once a year. Dr. Nusra offers it once a year, and he's quite entertaining.
I think.
Okay. So each core has its own private cache memory at the highest level, and shares with the lower levels.
and so each l. 1 cache is a subset of l. 2. So all of the L. Whatever's in every l. 1 cache is in the L 2 cache.
and there could be multiple copies of the same block in multiple different l. 1 cache, right?
So whatever
that core is running, whatever program that core is running, the instructions and data for that running process are in that cache. Yeah.
I mean, it would just be well, generally. The
L. 3 cache, I think, is not on the processor
will be here. It'd just be another level here.
Thank you.
Right, it would be so. L. 3 would be bigger than L. 2 and L. 2 would be a subset of what's in l. 3.
So we we saw that most of the processor modern processors
that were talked about in the discussion. Thread had
individual l 1 caches and it must perform better, or everybody wouldn't be doing
engineering statement of the day. So the hit rates higher than if they all shared the l 1 cash space.
Maybe in the future I could add that to the cash.
Anyway.
So multiple l 1 caches might have copies of the same block.
So the copies have to remain coherent. So we have this example. Here we have a block X, we have 2 cpus or 2 cores, a core, a and a core B, and they both have a copy of X
this block. Right?
So coherence would require that when CPU a overwrites this block and no other rights occur.
when CPU A goes and gets this value, it's going to return one right? This is like the simplest part, right? So it's not going to revert to 0, even though there's other 0 copies that say 0
out there. It's not going to revert. It's going to always return
one right? So it's not going to revert to an old value, and then also, what coherence requires is some kind of mechanism.
or B to find out that this thing was changed
right? So if B. Now wants to read X. It has to find out that it was changed. So we need some mechanism to do that
right.
And then also it's serialized. So once
a block gets changed a number of times. All the different copies get
those changes in the same order. So we're not going to revert to old copies right. It's just saying.
once someone, something gets changed everything. All the copies get those changes in the same right?
So we need some way to keep all of these
copies coherent without doing a whole lot of writing of blocks every time there's a change.
So what we do is called the Msi protocol.
So here's a another finite state machine. So every line of the cache.
So we have an l 1 cache.
and it has its lines right?
I know what lines are, each line is going to have
bits that represent the Msi. State, whether it's in state, M.
S.
Or I.
Right? So M is modified.
So if it's in the modified state, and I'll say in a minute what that means.
The bits are 1 0 0, indicating that
this line is in the M. State right.
If a line is in the S state, its bits are going to be 0, 1 0 indicating that it's in the S. State
S for stable
M for modified, and if it's in the I state some some line could be in the I state it's Msi. Bits will be 0 0 1, indicating that it's in the I state for invalid.
Okay, so every line is going to be in one of these 3 states.
And what happens? How it changes to another state is based on the State diagram.
I mean, yeah, the state, the finance statement issue.
So the M flag, again, is modified. And this says.
I have a copy that I wrote too.
Right?
So there's this line. And I wrote to it recently.
right? So I have modified this block. So I am in the M state.
The I State says
I have this block and some other cash wrote to it. What I have is invalid.
Okay?
Anyway. Yeah. Okay,
So
the copy I have of this line is is bad. It's invalid. So something needs to be done. If I want to read that thing.
and then the S. Flag says everything's copacetic. I don't know why we didn't start with S. But S. Says, Oh, everybody's copy is the same. We are coherent. Everything's wonderful and copacetic.
So how can we find out? So how do these different copies find out that something has happened to the block, and that's by snooping. So there is a
process called snooping, I said. Copacetic copacetic means stable right oops like everything's
calm in agreement, calm in agreement, I think. Is, isn't that what Coppa study means? Oh, alright, anyway. Sorry.
Our vocabulary lesson for the day.
What homeostasis?
That's another one. Well, I guess we're homeostatic, anyway. Okay.
how do we find out when we need to move to a different state? So we need some kind of mechanism to identify when
I need to move the to the invalid state. You know, some other process is asking for something that I modified. That's through snooping.
So.
there's a bus shared by all the l 1 caches that kind of looks at what reads and writes are to what blocks are happening to all of them. And if I care about something, I'm going to find out about it.
Okay, that makes sense. So everything that's happening. We're all snooping on each other to find out if they're doing something that matters to me.
So a snooping l 1 cache controller can identify any reader right from another. l. 1 cache for a block. It stores.
Okay? So if I have Block X,
and I'm snooping on all the reads and writes in all the other l 1 caches. If Block X is read or written in any other cache, I will find out.
Hi.
but how does this work?
Let's say so. This is from the dive into Systems book, which is, has a pretty good description of cash coherence.
So let's say, we have 2 cores.
core 0 and core one. They each have an l. 1 cache, and they both have a copy of the block from memory with the tag, 1, 2, 3. So the or the block number is 1, 2, 3. Okay, both have a copy.
and they are both in the estate. They both have the same value. Everything is wonderful hope it's up.
How amused we're all in agreement.
Right? So everything's good. We're all in this stable state.
Now, let's say Core 0 writes to that block.
So here we were in S. And now this thing has requested to write that block.
So we're going to move to the M state because we overrode it, and then this course, one
via snooping will say, Hey!
They just wrote to a block that I have so core one snoops, and it says, Oh, core 0 just changed that thing. I need to move into the I state.
So here another processor requested to write that block. So I'm going to move from S to I.
So now we have
4. 0 is in the M state. So now it's changed its state, and it has that new value
for one is in the I state
it'll stay in the I State until it overwrites
this with the new value, and it won't change to the I state until it actually asks to read it. So if it never asks to look at that block.
you know it won't change right?
So now we're here we are. Now, let's say core one now requests to read that block.
So it's going to say it's in the I state
the core 0 through snooping, said, Oh.
another core wants this thing that I have modified. So here it says, other processors request to read. So it's going to find this out via snooping and move from M. To S.
After it writes the copy of the block.
So now it writes its new copy to L. 2, and then core one says.
Okay, I was in I. So I'm going to get my new copy from L 2 and override it.
And so both are back in the best state.
And now everything has written the new value.
Make sense.
Yes.
yeah. So here this one.
this one modified it through snooping. It found out that someone else wanted to read it.
So it writes its new copy to L. 2 and I.
And then, once it writes its new copy to L. 2. This one that was invalid says, okay, I'm going to get that new value
from L, 2.
Yeah.
So it established that it was invalid.
When
so we were, we were copacetic.
And then this one wrote, and then in snooping
core one noticed that Core 0 wrote that thing and put itself into the I state.
Okay, you're snooping.
Make sense.
That's why you need these bits. And you need snooping.
Yeah.
I guess it depends on the design.
I guess some are. But I would think like.
I don't know. I mean, obviously, some like, you can get a computer now with the Gpu processor. Obviously, that's going to be
optimized for parallel process, yeah.
I, mean, I don't think so, but so multiple, I,
I guess, I don't understand your question like.
oh.
yeah.
yeah, I would think you would want to do that. Yeah, I don't know. But
if you want to do that definitely be on the script.
Okay.
okay, so let's say.
we have a block in both core 0 and core one. And the state is
both are in the S state. So core one rights to the block.
So what are the Msi bits for? That block? So core one rights. So here it's request to write.
So it's going to go to M.
So MSIM is one and the other 2 are 0.
Gonna be that one
all right, everyone. Good.
Okay.
Now, this one.
So this one is, what are the Ms. So now we've written this one is written
4. 1 writes to the block.
so it goes into the M state.
and 4 0 with snooping will go to the I state.
So its bits are going to be 0. 0.
Yeah, yeah, I don't know. I know.
I agree it is for every line I know.
I don't know if so.
this is how it's described. Like I, you know, when I looked.
I look for resources to teach this lecture. This is what it all said.
But maybe that's just for pedagogical purposes, because, yeah, you could do this with 2 bits, not 3, right?
So there's 3 states. You could do 3 states with 2 bid.
Right?
What?
Yeah, it could be could be, okay.
Okay, good. Well, there you go. I have an explanation.
Okay.
okay. One thing that can happen is what if you have this block and
you've changed a particular byte, and so that whole block gets labeled as invalid, and so the other, maybe the other core
wants to get
a byte in that block that hasn't been changed. So then you're going to cause all this writing to happen that maybe wasn't necessary so that can hurt
right? And maybe that was why, what you're talking about. Maybe you want to put it all into one block, like everything that's changing, putting it into one place.
Right? I am definitely not a
memory management. But I would think you would want to try to do so right.
Bye, bye,
actually, yeah, I'm a little early, but that's what I have for today. Are there any questions?
Yeah.
yeah, right? So it'll only get updated if somebody wants it.
Yeah, that's when the L 2 cache will get updated right? I know I enter whatever
turn it into like people. But yeah, but yeah, so if nobody ever asks to read this block other than that one l. 1 cache that overrode it. Then it'll never get
overwritten. It will actually, so at some point, if it gets
removed from the l 1 cache, it will get
updated down to the main number.
So if something gets ejected from the cache.
it'll make sure it updates all its copies for it
any other questions?
Okay? Well, then, you get 5 min back right
of your Friday. Have a great Friday. Have a great weekend.
We'll start virtual memory on Monday.
    """
    
    query = "Please concisely summarize this lecture including key points and important updates if there are any. Avoid using headers, section breaks, or any areas of your response that don’t have any added information in addition to headers such as: “Here is a concise summary of the lecture:”. Include key dates, exam information, anything mentioned as important or necessary, and skip over anything that is not important or repeated if applicable. This should be well formatted in a concise manner that discusses key points and additionally lists more info for key details and main points under them. All details of the lecture should be covered and it is imperative that you don't miss any details. If there are any details that you can not parse or ideas that aren’t clear, advise the user to review the lecture or check to make sure that the information is correct. You should avoid listing any information that is not relevant or where you have no info to share."

    # Initialize RAG system
    rag = RAGSystem()
    
    # Process the document
    result = rag.process_document(document, query)
    
    # Display results
    if result["success"]:
        print("\nGenerated Response:")
        print("="*50)
        print(result["response"])
        print("\nPerformance:")
        print(f"Total time: {result['processing_time']:.2f}s")
    else:
        print(f"\nError: {result['error']}")