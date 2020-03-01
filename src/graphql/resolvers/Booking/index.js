"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const Stripe_1 = require("../../../lib/api/Stripe");
const utils_1 = require("../../../lib/utils");
const bson_1 = require("bson");
exports.resolveBookingsIndex = (bookingsIndex, checkInDate, checkOutDate) => {
    let dateCursor = new Date(checkInDate);
    let checkOut = new Date(checkOutDate);
    let newBookingIndex = Object.assign({}, bookingsIndex);
    while (dateCursor <= checkOut) {
        const y = dateCursor.getUTCFullYear();
        const m = dateCursor.getUTCMonth();
        const d = dateCursor.getUTCDate();
        if (!newBookingIndex[y]) {
            newBookingIndex[y] = {};
        }
        if (!newBookingIndex[y][m]) {
            newBookingIndex[y][m] = {};
        }
        if (!newBookingIndex[y][m][d]) {
            newBookingIndex[y][m][d] = true;
        }
        else {
            throw new Error(`Dates that are already booked cannot be double booked.`);
        }
        dateCursor = new Date(dateCursor.getTime() + 86400000);
    }
    return newBookingIndex;
};
exports.bookingResolvers = {
    Booking: {
        id: (booking) => {
            return booking._id.toString();
        },
        listing: (booking, _args, { db }) => {
            return db.listings.findOne({ _id: booking.listing });
        },
        tenant: (booking, _args, { db }) => {
            return db.users.findOne({ _id: booking.tenant });
        }
    },
    Mutation: {
        createBooking: (_root, { input }, { db, req }) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const { id, source, checkIn, checkOut } = input;
                let viewer = yield utils_1.authorize(db, req);
                if (!viewer) {
                    throw new Error(`Viewer could not be verified.`);
                }
                const listing = yield db.listings.findOne({
                    _id: new bson_1.ObjectId(id)
                });
                if (!listing) {
                    throw new Error(`Failed to find listing.`);
                }
                if (listing.host === viewer._id) {
                    throw new Error(`Host cannot book own listing`);
                }
                const checkInDate = new Date(checkIn);
                const checkOutDate = new Date(checkOut);
                if (checkOutDate < checkInDate) {
                    throw new Error(`Check out date cannot be before check in date.`);
                }
                const bookingsIndex = exports.resolveBookingsIndex(listing.bookingsIndex, checkIn, checkOut);
                const totalPrice = listing.price * ((checkOutDate.getTime() - checkInDate.getTime()) / 86400000 + 1);
                const host = yield db.users.findOne({
                    _id: listing.host
                });
                if (!host || !host.walletId) {
                    throw new Error(`The host either can't be found or is not connected to Stripe.`);
                }
                yield Stripe_1.Stripe.charge(totalPrice, source, host.walletId);
                const insertRes = yield db.bookings.insertOne({
                    _id: new bson_1.ObjectId(),
                    listing: listing._id,
                    tenant: viewer._id,
                    checkIn,
                    checkOut
                });
                const insertedBooking = insertRes.ops[0];
                yield db.users.updateOne({ _id: host._id }, { $inc: { income: totalPrice }
                });
                yield db.users.updateOne({ _id: viewer._id }, { $push: { bookings: insertedBooking._id }
                });
                yield db.listings.updateOne({ _id: listing._id }, {
                    $set: { bookingsIndex },
                    $push: { bookings: insertedBooking._id }
                });
                return insertedBooking;
            }
            catch (error) {
                throw new Error(`Failed to create new booking: ${error}`);
            }
        })
    }
};
