const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './src/client/main.jsx',
  output: { path: path.resolve(__dirname, 'public'), filename: 'bundle.js', clean: true },
  resolve: { extensions: ['.js', '.jsx'] },
  module: { rules: [{ test: /\.jsx?$/, exclude: /node_modules/, use: { loader: 'babel-loader', options: { presets: ['@babel/preset-env', '@babel/preset-react'] } } }, { test: /\.css$/, use: ['style-loader', 'css-loader'] }] },
  plugins: [new HtmlWebpackPlugin({ template: './src/client/index.html', inject: 'body' })],
  devServer: { static: './public', historyApiFallback: true, port: 3000 }
};
