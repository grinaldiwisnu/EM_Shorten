const mysql = require("mysql");
const req = require("request");
const cons = require("./constants");
const crypto = require("crypto");
const connect = mysql.createPool({
    host: cons.host,
    user: cons.user,
    password: cons.password,
    database: cons.db
});

function generateHash(onSuccess, onError, retryCount, url, request, response, con, vanity) {
    let hash = "";
    if (vanity) {
        hash = vanity;
        const reg = /[^A-Za-z0-9-_]/;
        if (reg.test(hash) || hash === "add" || hash === "look") {
            onError(response, request, con, 403);
            return;
        }
        if (hash.length > 15) {
            onError(response, request, con, 405);
            return;
        } else if (cons.min_vanity > 0 && hash.length < cons.min_vanity) {
            onError(response, request, con, 407);
            return;
        }
    } else {
        const sha = crypto.createHash('sha1');
        sha.update((new Date).getTime() + "");
        hash = sha.digest('hex').substring(0, 8);
    }
    con.query(cons.get_query.replace("{SEGMENT}", con.escape(hash)), function (err, rows) {
        if (err) {
            console.log(err);
        }
        if (rows !== undefined && rows.length === 0) {
            onSuccess(hash, url, request, response, con);
        } else {
            if (retryCount > 1 && !vanity) {
                generateHash(onSuccess, onError, retryCount - 1, url, request, response, con);
            } else {
                onError(response, request, con, 400);
            }
        }
    });
}

function hashError(response, request, con, code) {
    response.send(urlResult(null, false, code));
}

function handleHash(hash, url, request, response, con) {
    con.query(cons.add_query.replace("{URL}", con.escape(url)).replace("{SEGMENT}", con.escape(hash)).replace("{IP}", con.escape(getIP(request))), function (err) {
        if (err) {
            console.log(err);
        }
    });
    response.send(urlResult(hash, true, 100));
}

function urlResult(hash, result, statusCode) {
    return {
        url: hash != null ? cons.root_url + hash : null,
        result: result,
        statusCode: statusCode
    };
}

const getUrl = function (segment, request, response) {
    connect.getConnection(function (err, con) {
        con.query(cons.get_query.replace("{SEGMENT}", con.escape(segment)), function (err, rows) {
            const result = rows;
            if (!err && rows.length > 0) {
                let referer = "";
                if (request.headers.referer) {
                    referer = request.headers.referer;
                }
                con.query(cons.insert_view.replace("{IP}", con.escape(getIP(request))).replace("{URL_ID}", con.escape(result[0].id)).replace("{REFERER}", con.escape(referer)), function (err) {
                    if (err) {
                        console.log(err);
                    }
                    con.query(cons.update_views_query.replace("{VIEWS}", con.escape(result[0].num_of_clicks + 1)).replace("{ID}", con.escape(result[0].id)), function (err) {
                        if (err) {
                            console.log(err);
                        }
                    });
                });
                response.redirect(result[0].url);
            } else {
                response.send(urlResult(null, false, 404));
            }
            if (err) {
                console.log(err);
            }
        });
        con.release();
    });
};

const addUrl = function (url, request, response, vanity) {
    connect.getConnection(function (err, con) {
        if (url) {
            url = decodeURIComponent(url).toLowerCase();
            con.query(cons.check_ip_query.replace("{IP}", con.escape(getIP(request))), function (err, rows) {
                if (err) {
                    console.log(err);
                }
                if (rows[0].counted !== undefined && rows[0].counted < cons.urls_per_hour) {
                    con.query(cons.check_url_query.replace("{URL}", con.escape(url)), function (err, rows) {
                        if (err) {
                            console.log(err);
                        }
                        if (url.indexOf("http://localhost") > -1 || url.indexOf("https://localhost") > -1) {
                            response.send(urlResult(null, 'false', 401));
                            return;
                        }
                        if (url.length > 1000) {
                            response.send(urlResult(null, false, 406));
                            return;
                        }
                        if (!err && rows.length > 0) {
                            response.send(urlResult(rows[0].segment, true, 100));
                        } else {
                            req(url, function (err, res) {
                                if (res !== undefined && res.statusCode === 200) {
                                    generateHash(handleHash, hashError, 50, url, request, response, con, vanity);
                                } else {
                                    response.send(urlResult(null, false, 401));
                                }
                            });
                        }
                    });
                } else {
                    response.send(urlResult(null, false, 408));
                }
            });
        } else {
            response.send(urlResult(null, false, 402));
        }
        con.release();
    });
};

const whatIs = function (url, request, response) {
    connect.getConnection(function (err, con) {
        let hash = url;
        if (!hash) hash = "";
        hash = hash.replace(cons.root_url, "");
        con.query(cons.get_query.replace("{SEGMENT}", con.escape(hash)), function (err, rows) {
            if (err || rows.length === 0) {
                response.send({result: false, url: null});
            } else {
                response.send({result: true, url: rows[0].url, hash: hash, clicks: rows[0].num_of_clicks});
            }
        });
        con.release();
    });
};

function getIP(request) {
    return request.header("x-forwarded-for") || request.connection.remoteAddress;
}

exports.getUrl = getUrl;
exports.addUrl = addUrl;
exports.whatIs = whatIs;