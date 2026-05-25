const {withAndroidStyles, AndroidConfig} = require("expo/config-plugins");

function withCustomAppTheme(config, customAppThemeParent) {
  return withAndroidStyles(config, (config) => {
    const styles = config.modResults;
    if (styles.resources.style) {
      // Filter out all existing AppTheme styles
      styles.resources.style = styles.resources.style.filter((style) => style.$.name !== "AppTheme");
    }

    // Define the desired single AppTheme style
    const newAppTheme = {
      $: {name: "AppTheme", parent: customAppThemeParent},
      item: [
        {
          _: "@drawable/rn_edit_text_material",
          $: {name: "android:editTextBackground"},
        },
        // Add other items if necessary, based on your desired theme
      ],
    };

    // Add the new AppTheme style to the beginning of the styles array
    if (!styles.resources.style) {
      styles.resources.style = [];
    }
    styles.resources.style.unshift(newAppTheme);

    return config;
  });
}

module.exports = withCustomAppTheme;
