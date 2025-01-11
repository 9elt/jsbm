// @ts-ignore
export async function PACKAGE_VERSION(): string {
    const version = JSON.parse(
        // @ts-ignore
        await Bun.file("package.json").text()
    ).version;

    if (!version) {
        console.error("Version not found in package.json");
        process.exit(1);
    }

    return version;
}
