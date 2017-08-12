/**
 * Copyright 2017 Phil Buchanan
 *
 * A very simple static website generator.
 *
 * @version 1.0.0
 */

const fs         = require('fs-extra');
const matter     = require('gray-matter');
const handlebars = require('handlebars');
const moment     = require('moment-timezone');
const recursive  = require('recursive-readdir-sync');
const marked     = require('marked');



// Load the primary site settings
var data = {};
data.site = fs.readJsonSync('./site/config/settings.json');



/**
 * Add Handlebars helpers
 */
handlebars.registerHelper({
	// A Handlebars helper to create a comma separated list
	commas: function(arr) {
		return new handlebars.SafeString(arr.join(', '));
	},

	// A Handlebars helpter to limit an array to a maximum of elements
	// Usage: {{# each (limit posts 5) }}
	limit: function(arr, limit) {
		return arr.slice(0, limit);
	},

	formatDate: function(date, format) {
		return moment(date, data.site.dateFormat).tz(data.site.timezone).format(format);
	},

	isSelected: function(page, current) {
		if ('/' + page === current) {
			return 'is-selected';
		}

		return '';
	}
});



/**
 * Automatically register all Handlebars partials from files in
 * `sites/templates/partials`.
 */
var partials = recursive('./site/templates/partials');

partials.forEach(function(partial) {
	// Get the name of the partial by looking for the `_`
	var name = partial.match(/_\w+/);
	var file = fs.readFileSync(partial, 'utf-8');
	var partial = handlebars.compile(file);

	handlebars.registerPartial(name[0].replace('_', ''), partial);
});



/**
 * Given a filepath to a markdown file, returns an object in the form of
 * { meta, body } where `meta` is the front matter and `body` is the markdown
 * content converted to HTML.
 *
 * @param filePath String The path to a file to parse
 * return An object with the meta content and post body content
 */
function parseMarkdown(filePath) {
	// Read the markdown post file
	var post = fs.readFileSync(filePath, 'utf-8');

	// Read the front matter of the markdown file
	var markdown = matter(post);

	// Map the markdown pieces to `meta` and `body` properties
	return {
		meta: markdown.data,
		body: marked(markdown.content)
	};
}



/**
 * Create a static HTML file from a template file.
 *
 * @param templateName String The string of the template file name
 * @param outputFile   String The name of the output file including extension
 * @param content      Object The data to pass to Handlebars
 */
function buildFileFromTemplate(templateName, outputFile, content) {
	var file = fs.readFileSync('./site/templates/' + templateName, 'utf-8');
	var template = handlebars.compile(file);
	var html = template(content);

	fs.writeFileSync('./build/' + outputFile, html, { encoding: 'utf-8' });
}



/**
 * Get page data object.
 *
 * @param content Object The content object to set page properties from
 * return Object The page properties object
 */
function getPageData(content) {
	var pageData = {};
	var siteTitle = data.site.title;
	var pageTitle = content.meta.title;

	pageData.title = pageTitle + ' | ' + siteTitle;

	return pageData;
}



// Make or clean the `build` directory
fs.emptyDirSync('./build');

// Copy the assets to the build directory
fs.copySync('./site/assets', './build/assets');



/**
 * Generate the 404 error page
 */
// Make a copy of the main data object
var errorData = data;

errorData.page = {
	title: 'Page Not Found | ' + data.site.title
};

buildFileFromTemplate('404.html', '404.html', errorData);



// Get all the pages into a `pages` array. Filter for only `.md` files.
var pages = recursive('./site/content/pages').filter(function(filePath) {
	return /.+\.md$/.test(filePath);
});

// Set the base post type slug
var slug = '/';

// Get Markdown compiled content for all posts
pages = pages.map(parseMarkdown);

// Generate posts HTML pages
pages.forEach(function(page) {
	// Make a copy of the main data object
	var pageData = data;

	// Add the post meta and body to the main data `content` property
	pageData.content = page;

	// Reset the post slug with post type
	pageData.content.meta.slug = slug + page.meta.slug;

	// Get the page level data object and assign it to the `page` property
	pageData.page = getPageData(page);

	// Create a directory for each post
	fs.emptyDirSync('./build/' + pageData.content.meta.slug);

	buildFileFromTemplate('page.html', pageData.content.meta.slug + '/index.html', pageData);
});



/**
 * Generate the home page
 */
// Make a copy of the main data object
var homeData = data;

// Load the home page file and set site wide properties
homeData.content = parseMarkdown('./site/content/home.md');
homeData.page = getPageData(homeData.content, true);

buildFileFromTemplate('page.html', 'index.html', homeData);
