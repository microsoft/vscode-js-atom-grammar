/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

var path = require('path');
var fs = require('fs');
var cson = require('cson-parser');
var https = require('https');
var url = require('url');

function getCommitSha(repoId, repoPath) {
	var commitInfo = 'https://api.github.com/repos/' + repoId + '/commits?path=' + repoPath;
	return download(commitInfo).then(function (content) {
		try {
			let lastCommit = JSON.parse(content)[0];
			return Promise.resolve({
				commitSha: lastCommit.sha,
				commitDate: lastCommit.commit.author.date
			});
		} catch (e) {
			return Promise.resolve(null);
		}
	}, function () {
		console.err('Failed loading ' + commitInfo);
		return Promise.resolve(null);
	});
}

function download(urlString) {
	return new Promise((c, e) => {
		var _url = url.parse(urlString);
		var options = { host: _url.host, port: _url.port, path: _url.path, headers: { 'User-Agent': 'NodeJS' }};
		var content = '';
		var request = https.get(options, function (response) {
			response.on('data', function (data) {
				content += data.toString();
			}).on('end', function () {
				c(content);
			});
		}).on('error', function (err) {
			e(err.message);
		});
	});
}

exports.update = function (repoId, repoPath, dest, modifyGrammar) {
	var contentPath = 'https://raw.githubusercontent.com/' + repoId + '/master/' + repoPath;
	console.log('Reading from ' + contentPath);
	return download(contentPath).then(function (content) {
		var ext = path.extname(repoPath);
		var grammar;
		if (ext === '.cson') {
			grammar = cson.parse(content);
		} else if (ext === '.json') {
			grammar = JSON.parse(content);
		} else {
			console.error('Unknown file extension: ' + ext);
			return;
		}
		if (modifyGrammar) {
			modifyGrammar(grammar);
		}
		return getCommitSha(repoId, repoPath).then(function (info) {
			if (info) {
				grammar.version = 'https://github.com/' + repoId + '/commit/' + info.commitSha;
			}
			try {
				fs.writeFileSync(dest, JSON.stringify(grammar, null, '\t'));
				if (info) {
					console.log('Updated ' + path.basename(dest) + ' to ' + repoId + '@' + info.commitSha.substr(0, 7) + ' (' + info.commitDate.substr(0, 10) + ')');
				} else {
					console.log('Updated ' + path.basename(dest));
				}
			} catch (e) {
				console.error(e);
			}
		});

	}, console.error);
}

if (path.basename(process.argv[1]) === 'update-grammar.js') {
	exports.update(process.argv[2], process.argv[3], process.argv[4]);
}



