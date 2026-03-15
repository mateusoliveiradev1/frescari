export function buildConnectionStringWithPgSettings(
    connectionString: string,
    settings: Record<string, string>,
) {
    const url = new URL(connectionString);
    const existingOptions = url.searchParams.get('options');
    const nextOptions = Object.entries(settings).map(
        ([key, value]) => `-c ${key}=${value}`,
    );

    const mergedOptions = [existingOptions, ...nextOptions]
        .filter((option): option is string => typeof option === 'string' && option.length > 0)
        .join(' ');

    url.searchParams.set('options', mergedOptions);

    return url.toString();
}
