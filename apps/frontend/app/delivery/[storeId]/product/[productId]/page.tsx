'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Heart, Share2, Minus, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const PRODUCT_DATA = {
  1: {
    name: 'Melting Cheese Pizza',
    store: 'Pizza Italiano',
    rating: 4.8,
    reviews: 2200,
    image: '🍕',
    description: 'Fresh mozzarella, parmesan, and melted cheddar on a crispy crust',
    sizes: [
      { id: 'small', label: 'Small', size: '6"', price: 8.99 },
      { id: 'medium', label: 'Medium', size: '8"', price: 10.99 },
      { id: 'large', label: 'Large', size: '10"', price: 12.99 },
    ],
    ingredients: [
      { id: 1, name: 'Chicken', price: 1.4, selected: true },
      { id: 2, name: 'Mushroom', price: 0.4, selected: false },
      { id: 3, name: 'Extra Cheese', price: 0.8, selected: false },
      { id: 4, name: 'Pepperoni', price: 1.2, selected: false },
    ],
  },
};

export default function ProductDetailPage() {
  const params = useParams();
  const productId = params.productId as string;
  const product = PRODUCT_DATA[productId as keyof typeof PRODUCT_DATA];
  const [selectedSize, setSelectedSize] = useState('medium');
  const [selectedIngredients, setSelectedIngredients] = useState<number[]>([1]);
  const [quantity, setQuantity] = useState(1);

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Product not found</p>
      </div>
    );
  }

  const sizeData = product.sizes.find((s) => s.id === selectedSize);
  const ingredientPrice = product.ingredients
    .filter((i) => selectedIngredients.includes(i.id))
    .reduce((sum, i) => sum + i.price, 0);
  const totalPrice = (sizeData?.price || 0) + ingredientPrice;
  const cartTotal = totalPrice * quantity;

  return (
    <motion.div
      className="min-h-screen bg-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header with Image */}
      <div className="sticky top-0 z-40 bg-white">
        <div className="relative bg-gradient-to-b from-gray-100 to-white pt-4 pb-8">
          <div className="flex justify-between px-4 mb-4">
            <Link href={`/delivery/${params.storeId}`}>
              <button className="p-2 hover:bg-gray-100 rounded-lg">
                <ArrowLeft className="w-6 h-6 text-gray-900" />
              </button>
            </Link>
            <div className="flex gap-2">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <Heart className="w-6 h-6 text-gray-600 hover:text-red-500" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <Share2 className="w-6 h-6 text-gray-600" />
              </motion.button>
            </div>
          </div>

          {/* Product Image */}
          <div className="flex justify-center mb-6">
            <div className="text-9xl">{product.image}</div>
          </div>
        </div>
      </div>

      {/* Product Info */}
      <div className="px-4 py-4 space-y-1 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
        <p className="text-sm text-gray-600">{product.store}</p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-yellow-500 font-semibold">★ {product.rating}</span>
          <span className="text-gray-500 text-sm">({product.reviews})</span>
        </div>
      </div>

      {/* Size Selector */}
      <div className="px-4 py-6 border-b border-gray-200">
        <h3 className="font-bold text-gray-900 mb-4">Select Size</h3>
        <div className="grid grid-cols-3 gap-3">
          {product.sizes.map((size) => (
            <motion.button
              key={size.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedSize(size.id)}
              className={`rounded-2xl p-4 border-2 transition-all ${
                selectedSize === size.id
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <p className="text-sm font-semibold text-gray-900">{size.size}</p>
              <p className="text-xs text-gray-600 mt-1">{size.label}</p>
              <p className="text-sm font-bold text-gray-900 mt-2">${size.price.toFixed(2)}</p>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Add Ingredients */}
      <div className="px-4 py-6 border-b border-gray-200">
        <h3 className="font-bold text-gray-900 mb-4">Add Ingredients</h3>
        <div className="space-y-3">
          {product.ingredients.map((ingredient) => (
            <label key={ingredient.id} className="flex items-center gap-3 cursor-pointer p-3 hover:bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                checked={selectedIngredients.includes(ingredient.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedIngredients([...selectedIngredients, ingredient.id]);
                  } else {
                    setSelectedIngredients(selectedIngredients.filter((id) => id !== ingredient.id));
                  }
                }}
                className="w-5 h-5 accent-green-500 rounded"
              />
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{ingredient.name}</p>
                <p className="text-xs text-gray-600">{ingredient.id === 1 ? '250 gm' : '50 gm'}</p>
              </div>
              <span className="text-sm font-semibold text-gray-900">+${ingredient.price.toFixed(2)}</span>
              {selectedIngredients.includes(ingredient.id) && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center"
                >
                  <span className="text-white text-xs">✓</span>
                </motion.div>
              )}
            </label>
          ))}
        </div>
      </div>

      {/* Spacer */}
      <div className="h-32" />

      {/* Sticky Bottom - Quantity & Add to Cart */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4 flex items-center gap-3">
        {/* Quantity Stepper */}
        <div className="flex items-center gap-2 border-2 border-gray-200 rounded-full p-1">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full"
          >
            <Minus className="w-4 h-4 text-gray-600" />
          </motion.button>
          <span className="w-6 text-center font-semibold text-gray-900">{quantity}</span>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setQuantity(quantity + 1)}
            className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full"
          >
            <Plus className="w-4 h-4 text-gray-600" />
          </motion.button>
        </div>

        {/* Add to Cart Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-full transition-colors"
        >
          Add to Cart • ${cartTotal.toFixed(2)}
        </motion.button>
      </div>
    </motion.div>
  );
}
