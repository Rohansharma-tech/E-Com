const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// DEBUG: Comprehensive .env analysis
console.log('=== DEBUG: .env FILE ANALYSIS ===');
console.log('Current directory:', __dirname);
const envPath = path.join(__dirname, '.env');
console.log('.env file path:', envPath);
console.log('File exists:', fs.existsSync(envPath));

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  console.log('=== .env FILE CONTENT START ===');
  console.log(envContent);
  console.log('=== .env FILE CONTENT END ===');
  
  // Check each line individually
  console.log('=== LINE BY LINE ANALYSIS ===');
  const lines = envContent.split('\n');
  let validVariables = 0;
  
  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      console.log(`Line ${index + 1}: "${line}"`);
      
      if (trimmedLine.includes('=')) {
        const parts = trimmedLine.split('=');
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        console.log(`   ✅ Key: "${key}" | Value: "${value}"`);
        validVariables++;
      } else {
        console.log(`   ❌ INVALID FORMAT: No equals sign found`);
      }
    }
  });
  
  console.log(`Valid environment variables found: ${validVariables}`);
}

// Load environment variables
const result = require('dotenv').config({ path: envPath });

if (result.error) {
  console.log('❌ Dotenv loading error:', result.error);
} else {
  console.log('✅ Dotenv loaded successfully');
  if (result.parsed) {
    console.log('Parsed variables:', Object.keys(result.parsed));
  }
}

console.log('=== ENVIRONMENT VARIABLES CHECK ===');
console.log('EMAIL_HOST:', process.env.EMAIL_HOST || 'Not set');
console.log('EMAIL_PORT:', process.env.EMAIL_PORT || 'Not set');
console.log('EMAIL_USER:', process.env.EMAIL_USER ? `"${process.env.EMAIL_USER}"` : 'NOT SET');
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? 'SET (hidden)' : 'NOT SET');
console.log('EMAIL_SERVICE:', process.env.EMAIL_SERVICE || 'Not set');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'SET (hidden)' : 'NOT SET');
console.log('PORT:', process.env.PORT || 'Not set');
console.log('MONGODB_URI:', process.env.MONGODB_URI || 'Not set');
console.log('===================================');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Models
const User = mongoose.model('User', {
  name: String,
  email: { type: String, unique: true },
  password: String,
  createdAt: { type: Date, default: Date.now }
});

const Product = mongoose.model('Product', {
  name: String,
  description: String,
  price: Number,
  category: String,
  image: String,
  stock: Number,
  createdAt: { type: Date, default: Date.now }
});

const Order = mongoose.model('Order', {
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  products: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    quantity: Number,
    price: Number
  }],
  totalAmount: Number,
  shippingAddress: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  status: { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

// ✅ CORRECTED: Email Configuration for Mailtrap
let transporter;

if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'sandbox.smtp.mailtrap.io',
    port: process.env.EMAIL_PORT || 2525,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  console.log('Using Mailtrap configuration');

  transporter.verify(function(error, success) {
    if (error) {
      console.log('Email configuration error:', error.message);
    } else {
      console.log('Email server is ready to send messages...!');
    }
  });
} else {
  console.log('Email credentials not found. Email functionality disabled.');
  transporter = null;
}

// ✅ FIXED: Modified email function
async function sendOrderConfirmationEmail(order, user, productDetails) {
  if (!transporter) {
    console.log('Email transporter not available. Skipping email send.');
    return;
  }

  try {
    const mailOptions = {
      from: process.env.EMAIL_USER || 'noreply@ecommerce.com',
      to: user.email,
      subject: 'Order Confirmation - E-commerce Store',
      html: `
        <h1>Order Confirmation</h1>
        <p>Dear ${user.name},</p>
        <p>Thank you for your order! Here are your order details:</p>
        
        <h2>Order Summary</h2>
        <table border="1" style="border-collapse: collapse; width: 100%;">
          <thead>
            <tr>
              <th>Product</th>
              <th>Quantity</th>
              <th>Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${productDetails.map(item => `
              <tr>
                <td>${item.name}</td>
                <td>${item.quantity}</td>
                <td>$${item.price}</td>
                <td>$${item.price * item.quantity}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <h3>Total Amount: $${order.totalAmount}</h3>
        
        <h2>Shipping Address</h2>
        <p>${order.shippingAddress.street}<br>
           ${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zipCode}<br>
           ${order.shippingAddress.country}</p>
        
        <p>Your order status: <strong>${order.status}</strong></p>
        <p>We'll notify you when your order ships.</p>
        
        <p>Best regards,<br>E-commerce Store Team</p>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('Order confirmation email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error.message);
  }
}

// Middleware to verify token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// Routes

// Register
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword });
    await user.save();

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all products
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create order
app.post('/api/orders', authenticateToken, async (req, res) => {
  try {
    const { products, shippingAddress } = req.body;

    let totalAmount = 0;
    const productDetails = [];
    
    for (const item of products) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(400).json({ message: `Product ${item.productId} not found` });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({ message: `Insufficient stock for ${product.name}` });
      }
      totalAmount += product.price * item.quantity;
      productDetails.push({
        productId: product._id,
        name: product.name,
        price: product.price,
        quantity: item.quantity
      });

      product.stock -= item.quantity;
      await product.save();
    }

    const order = new Order({
      userId: req.user.userId,
      products: productDetails.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price
      })),
      totalAmount,
      shippingAddress
    });

    await order.save();
    const user = await User.findById(req.user.userId);
    await sendOrderConfirmationEmail(order, user, productDetails);

    res.status(201).json({
      message: 'Order created successfully',
      order: {
        ...order.toObject(),
        user: { name: user.name, email: user.email },
        productDetails: productDetails
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user orders
app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.userId })
      .populate('products.productId')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Insert sample products
app.post('/api/seed-products', async (req, res) => {
  try {
    await Product.deleteMany({});
    
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
        image: "https://via.placeholder.com/300",
        stock: 75
      },
      {
        name: "Coffee Maker",
        description: "Automatic coffee maker with timer",
        price: 149.99,
        category: "Home",
        image: "https://via.placeholder.com/300",
        stock: 40
      }
    ];

    await Product.insertMany(sampleProducts);
    res.json({ message: 'Sample products added successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error seeding products', error: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ message: 'Server is running!' });
});

const PORT = process.env.PORT || 5500;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});