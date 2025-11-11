const mongoose = require('mongoose');
require('dotenv').config();

const sampleProducts = [
  {
    name: "Smartphone X",
    description: "Latest smartphone with advanced features",
    price: 699.99,
    category: "Electronics",
    image: "https://via.placeholder.com/300",
    stock: 50
  },
  {
    name: "Laptop Pro",
    description: "High-performance laptop for professionals",
    price: 1299.99,
    category: "Electronics",
    image: "https://via.placeholder.com/300",
    stock: 30
  },
  {
    name: "Wireless Headphones",
    description: "Noise-cancelling wireless headphones",
    price: 199.99,
    category: "Electronics",
    image: "https://via.placeholder.com/300",
    stock: 100
  },
  {
    name: "Running Shoes",
    description: "Comfortable running shoes for athletes",
    price: 89.99,
    category: "Sports",
    image: "https://postimg.cc/8sgtF3kj",
    stock: 75
  },
  {
    name: "Coffee Maker",
    description: "Automatic coffee maker with timer",
    price: 149.99,
    category: "Home",
    image: "https://via.placeholder.com/300",
    stock: 40
  },
];

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce');
    console.log('Connected to MongoDB');
    
    // Define the Product model here (same as in server.js)
    const Product = mongoose.model('Product', {
      name: String,
      description: String,
      price: Number,
      category: String,
      image: String,
      stock: Number,
      createdAt: { type: Date, default: Date.now }
    });
    
    // Check if model already exists to avoid OverwriteModelError
    if (mongoose.models.Product) {
      delete mongoose.models.Product;
    }
    
    await Product.deleteMany({});
    console.log('Cleared existing products');
    
    await Product.insertMany(sampleProducts);
    console.log('Sample products added successfully');
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();