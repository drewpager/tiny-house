"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_merge_1 = __importDefault(require("lodash.merge"));
const Listing_1 = require("./Listing");
const Booking_1 = require("./Booking");
const Viewer_1 = require("./Viewer");
const User_1 = require("./User");
exports.resolvers = lodash_merge_1.default(Listing_1.listingResolvers, Booking_1.bookingResolvers, Viewer_1.viewerResolvers, User_1.userResolvers);
